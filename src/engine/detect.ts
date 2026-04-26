import type { DoseEvent }           from '../types/dose-event.js';
import type { AlertRecord }          from '../types/alert-record.js';
import type { AlertThresholdConfig } from '../types/config.js';
import type { Effect }               from '../types/effects.js';
import type { AuditEntry }           from '../types/audit-entry.js';
import type { ActorId, EventId }     from '../types/domain.js';

/**
 * The actor ID written to audit entries produced by automated detection.
 * Cast once here; never re-cast elsewhere in this module.
 */
const SYSTEM_ACTOR = 'system' as ActorId;

/**
 * Evaluate whether a scheduled dose is overdue and should trigger an alert.
 *
 * Pure function — given identical inputs this function always returns
 * identical outputs with no observable side effects (REQ-010). All I/O is
 * deferred to the returned `Effect[]`, which the shell layer executes.
 *
 * `eventId` is injected by the caller so that UUID generation (inherently
 * non-deterministic) stays outside this function. The shell pre-generates
 * the UUID before calling; tests supply a fixed string.
 *
 * State-machine behaviour
 * -----------------------
 *   INACTIVE  + elapsed >= threshold  →  [WRITE_AUDIT, PERSIST_ALERT_RECORD, EMIT_ALERT_ACTIVE]
 *   INACTIVE  + elapsed <  threshold  →  []
 *   any other current state           →  []  (REQ-003: no duplicate ALERT_ACTIVE)
 *
 * @satisfies REQ-001 REQ-002 REQ-003 REQ-010
 */
export function evaluateDetection(
  dose:    DoseEvent,
  current: AlertRecord,
  config:  AlertThresholdConfig,
  now:     Date,
  eventId: EventId,
): Effect[] {
  // REQ-003: only INACTIVE may transition to ALERT_ACTIVE.
  // Any other state means an alert is already in flight — return nothing.
  if (current.kind !== 'INACTIVE') {
    return [];
  }

  // REQ-001: compare in milliseconds to avoid floating-point rounding when
  // the elapsed time is very close to the threshold boundary.
  const elapsedMs   = now.getTime() - dose.scheduledAt.getTime();
  const thresholdMs = config.alertThresholdMinutes * 60 * 1000;

  if (elapsedMs < thresholdMs) {
    return [];
  }

  // REQ-002: the ALERT_ACTIVE record carries patientId, medicationName, and
  // alertedAt so recipients know what dose is overdue and since when.
  const alertRecord: Extract<AlertRecord, { kind: 'ALERT_ACTIVE' }> = {
    kind:           'ALERT_ACTIVE',
    doseId:         dose.doseId,
    patientId:      dose.patientId,
    medicationName: dose.medicationName,
    scheduledAt:    dose.scheduledAt,
    alertedAt:      now,
  };

  // REQ-006: audit entry records the transition with UTC timestamp and actor.
  const auditEntry: AuditEntry = {
    eventId,
    timestamp:  now.toISOString(),
    actorId:    SYSTEM_ACTOR,
    transition: 'INACTIVE \u2192 ALERT_ACTIVE',
    doseId:     dose.doseId,
    payload: {
      patientId:      dose.patientId as string,
      medicationName: dose.medicationName,
      scheduledAt:    dose.scheduledAt.toISOString(),
      alertedAt:      now.toISOString(),
      elapsedMs,
    },
  };

  // Effects are ordered: persist audit first (REQ-006 requires audit written
  // before the transition is considered committed), then state snapshot,
  // then external notification.
  return [
    { kind: 'WRITE_AUDIT',          entry:  auditEntry  },
    { kind: 'PERSIST_ALERT_RECORD', record: alertRecord },
    { kind: 'EMIT_ALERT_ACTIVE',    record: alertRecord },
  ];
}
