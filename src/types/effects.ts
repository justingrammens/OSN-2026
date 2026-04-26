import type { AlertRecord } from './alert-record.js';
import type { AuditEntry } from './audit-entry.js';

/**
 * Side-effect algebra for the pure state engine.
 *
 * Engine functions return `Effect[]` instead of executing I/O directly.
 * The application shell (`src/shell/effect-runner.ts`) interprets and
 * executes the returned list in order against the injected adapters.
 *
 * This keeps every engine function free of I/O and therefore deterministic,
 * testable, and independently verifiable.
 *
 * @satisfies REQ-002 REQ-004 REQ-006 REQ-009
 */
export type Effect =
  | {
      readonly kind:   'EMIT_ALERT_ACTIVE';
      readonly record: Extract<AlertRecord, { kind: 'ALERT_ACTIVE' }>;
    }
  | {
      readonly kind:   'EMIT_ALERT_ESCALATED';
      readonly record: Extract<AlertRecord, { kind: 'ALERT_ESCALATED' }>;
    }
  | {
      readonly kind:    'EMIT_SYSTEM_ALERT';
      readonly error:   Error;
      readonly context: string;
    }
  | {
      readonly kind:  'WRITE_AUDIT';
      readonly entry: AuditEntry;
    }
  | {
      readonly kind:   'PERSIST_ALERT_RECORD';
      readonly record: AlertRecord;
    };
