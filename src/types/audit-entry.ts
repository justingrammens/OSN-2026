import type { EventId, ActorId, DoseId } from './domain.js';

/**
 * Immutable record written to the append-only audit log for every state
 * transition and every rejected action.
 *
 * Records are never updated or deleted after they are written. The repository
 * adapter (not business logic) generates `eventId` via `crypto.randomUUID()`.
 *
 * `timestamp` is always an ISO 8601 UTC string with a `Z` suffix — never a
 * bare `Date` object, which would silently coerce to local time in some
 * serialisation paths.
 *
 * `actorId` must be non-empty. Automated system actions use `"system" as ActorId`.
 *
 * @satisfies REQ-006 REQ-007
 */
export interface AuditEntry {
  readonly eventId:    EventId;
  readonly timestamp:  string;  // e.g. "2026-04-21T09:00:00.000Z"
  readonly actorId:    ActorId;
  readonly transition: string;  // e.g. "INACTIVE → ALERT_ACTIVE"
  readonly doseId:     DoseId;
  readonly payload:    Readonly<Record<string, unknown>>;
}
