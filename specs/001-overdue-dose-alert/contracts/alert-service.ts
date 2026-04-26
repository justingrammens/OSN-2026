/**
 * Port interfaces for the Overdue Dose Alert with Escalation feature.
 *
 * These are the seam types: production adapters and test fakes both implement
 * these interfaces. Business logic MUST NOT import concrete adapter classes.
 *
 * @satisfies REQ-006 (AuditRepository), REQ-003 REQ-005 (AlertRepository),
 *            REQ-002 REQ-004 REQ-009 (Notifier)
 */

// ---------------------------------------------------------------------------
// Branded primitive types
// ---------------------------------------------------------------------------

export type DoseId    = string & { readonly __brand: 'DoseId' };
export type PatientId = string & { readonly __brand: 'PatientId' };
export type ActorId   = string & { readonly __brand: 'ActorId' };
export type EventId   = string & { readonly __brand: 'EventId' }; // UUID v4

// ---------------------------------------------------------------------------
// Domain records
// ---------------------------------------------------------------------------

export interface DoseEvent {
  readonly doseId:         DoseId;
  readonly patientId:      PatientId;
  readonly medicationName: string;
  readonly scheduledAt:    Date; // UTC
}

export type AlertRecord =
  | { readonly kind: 'INACTIVE';       readonly doseId: DoseId }
  | {
      readonly kind:            'ALERT_ACTIVE';
      readonly doseId:          DoseId;
      readonly patientId:       PatientId;
      readonly medicationName:  string;
      readonly scheduledAt:     Date;
      readonly alertedAt:       Date;
    }
  | {
      readonly kind:            'ALERT_ESCALATED';
      readonly doseId:          DoseId;
      readonly patientId:       PatientId;
      readonly medicationName:  string;
      readonly scheduledAt:     Date;
      readonly alertedAt:       Date;
      readonly escalatedAt:     Date;
    }
  | {
      readonly kind:            'ACKNOWLEDGED';
      readonly doseId:          DoseId;
      readonly patientId:       PatientId;
      readonly medicationName:  string;
      readonly scheduledAt:     Date;
      readonly alertedAt:       Date;
      readonly escalatedAt?:    Date;
      readonly acknowledgedAt:  Date;
      readonly acknowledgedBy:  ActorId;
    };

export interface AuditEntry {
  readonly eventId:    EventId;
  readonly timestamp:  string; // ISO 8601 UTC with Z suffix
  readonly actorId:    ActorId;
  readonly transition: string; // e.g. "INACTIVE → ALERT_ACTIVE"
  readonly doseId:     DoseId;
  readonly payload:    Readonly<Record<string, unknown>>;
}

export interface AlertThresholdConfig {
  readonly alertThresholdMinutes:      number; // positive integer
  readonly escalationThresholdMinutes: number; // positive integer
}

// ---------------------------------------------------------------------------
// Effect algebra (returned by pure engine functions)
// ---------------------------------------------------------------------------

export type Effect =
  | { readonly kind: 'EMIT_ALERT_ACTIVE';    readonly record: Extract<AlertRecord, { kind: 'ALERT_ACTIVE' }> }
  | { readonly kind: 'EMIT_ALERT_ESCALATED'; readonly record: Extract<AlertRecord, { kind: 'ALERT_ESCALATED' }> }
  | { readonly kind: 'EMIT_SYSTEM_ALERT';    readonly error: Error; readonly context: string }
  | { readonly kind: 'WRITE_AUDIT';          readonly entry: AuditEntry }
  | { readonly kind: 'PERSIST_ALERT_RECORD'; readonly record: AlertRecord };

// ---------------------------------------------------------------------------
// Port interfaces (adapters)
// ---------------------------------------------------------------------------

/**
 * Append-only audit store.
 * Implementing adapters MUST NOT expose UPDATE or DELETE operations.
 * @satisfies REQ-006
 */
export interface AuditRepository {
  append(entry: AuditEntry): Promise<void>;
  findByDoseId(doseId: DoseId): Promise<readonly AuditEntry[]>;
}

/**
 * Current derived state per dose event.
 * Used by the engine to determine whether an alert has already been raised,
 * preventing duplicate ALERT_ACTIVE and ALERT_ESCALATED events.
 * @satisfies REQ-003, REQ-005
 */
export interface AlertRepository {
  findByDoseId(doseId: DoseId): Promise<AlertRecord | undefined>;
  save(record: AlertRecord): Promise<void>;
}

/**
 * Delivers alert events to external recipients (care team, charge nurse,
 * system operator). Swapped for an in-memory recording fake in tests.
 * @satisfies REQ-002, REQ-004, REQ-009
 */
export interface Notifier {
  dispatchAlertActive(
    record: Extract<AlertRecord, { kind: 'ALERT_ACTIVE' }>
  ): Promise<void>;
  dispatchAlertEscalated(
    record: Extract<AlertRecord, { kind: 'ALERT_ESCALATED' }>
  ): Promise<void>;
  dispatchSystemAlert(error: Error, context: string): Promise<void>;
}
