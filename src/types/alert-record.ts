import type { DoseId, PatientId, ActorId } from './domain.js';

/**
 * Full lifecycle state of an alert for a single DoseEvent.
 *
 * Discriminated on `kind`. Each variant carries only the fields that are
 * meaningful in that state — illegal states are unrepresentable at compile time.
 * Transitions are strictly left-to-right:
 *
 *   INACTIVE → ALERT_ACTIVE → ALERT_ESCALATED → ACKNOWLEDGED
 *                          ↘________________________↗  (direct ack skips escalation)
 *
 * All `Date` values are UTC and must be injected — never read from system clock.
 *
 * @satisfies REQ-003 REQ-005
 */
export type AlertRecord =
  | {
      readonly kind:    'INACTIVE';
      readonly doseId:  DoseId;
    }
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
