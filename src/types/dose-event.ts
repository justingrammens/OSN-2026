import type { DoseId, PatientId } from './domain.js';

/**
 * Immutable record representing a single scheduled medication administration.
 *
 * Delivered by the upstream scheduling system. This module never creates or
 * modifies dose events — it only reads them.
 *
 * `scheduledAt` is UTC. It must never be derived from the system clock inside
 * business logic; it arrives as data from the caller.
 */
export interface DoseEvent {
  readonly doseId:         DoseId;
  readonly patientId:      PatientId;
  readonly medicationName: string;
  readonly scheduledAt:    Date; // UTC
}
