import { describe, it, expect, beforeEach } from 'vitest';
import { evaluateDetection } from '../../../src/engine/detect.js';
import type { DoseEvent }            from '../../../src/types/dose-event.js';
import type { AlertRecord }          from '../../../src/types/alert-record.js';
import type { AlertThresholdConfig } from '../../../src/types/config.js';
import type { Effect }               from '../../../src/types/effects.js';
import type { DoseId, PatientId, ActorId, EventId } from '../../../src/types/domain.js';

// ---------------------------------------------------------------------------
// Shared fixtures — all time values are UTC Date literals (no ambient clock)
// ---------------------------------------------------------------------------

const DOSE_ID    = 'dose-001'    as DoseId;
const PATIENT_ID = 'patient-042' as PatientId;
const EVENT_ID   = '00000000-0000-0000-0000-000000000001' as EventId;

const SCHEDULED_AT = new Date('2026-04-21T09:00:00.000Z');

const DOSE: DoseEvent = Object.freeze({
  doseId:         DOSE_ID,
  patientId:      PATIENT_ID,
  medicationName: 'Metformin 500mg',
  scheduledAt:    SCHEDULED_AT,
});

const CONFIG: AlertThresholdConfig = Object.freeze({
  alertThresholdMinutes:      15,
  escalationThresholdMinutes: 10,
});

const INACTIVE: Extract<AlertRecord, { kind: 'INACTIVE' }> = Object.freeze({
  kind:   'INACTIVE',
  doseId: DOSE_ID,
});

/** Exactly at threshold: T+15:00.000 — must fire. */
const AT_THRESHOLD    = new Date(SCHEDULED_AT.getTime() + 15 * 60 * 1000);
/** 1 ms below threshold: T+14:59:59.999 — must NOT fire. */
const BELOW_THRESHOLD = new Date(SCHEDULED_AT.getTime() + 15 * 60 * 1000 - 1);
/** 0 ms elapsed — must NOT fire. */
const AT_SCHEDULED    = new Date(SCHEDULED_AT.getTime());
/** 1 ms before scheduled — must NOT fire. */
const BEFORE_SCHEDULED = new Date(SCHEDULED_AT.getTime() - 1);
/** 25 minutes past — well past threshold. */
const WELL_PAST       = new Date(SCHEDULED_AT.getTime() + 25 * 60 * 1000);

// ---------------------------------------------------------------------------
// Helper: extract a typed effect by kind
// ---------------------------------------------------------------------------

function findEffect<K extends Effect['kind']>(
  effects: Effect[],
  kind: K,
): Extract<Effect, { kind: K }> | undefined {
  return effects.find((e): e is Extract<Effect, { kind: K }> => e.kind === kind);
}

// ---------------------------------------------------------------------------
// REQ-001: Detect overdue dose at threshold boundary
// ---------------------------------------------------------------------------

describe('REQ-001: detect overdue dose at threshold boundary', () => {
  it('emits 3 effects when elapsed equals threshold exactly (T+15:00.000)', () => {
    const effects = evaluateDetection(DOSE, INACTIVE, CONFIG, AT_THRESHOLD, EVENT_ID);

    expect(effects).toHaveLength(3);
    expect(effects.map((e) => e.kind)).toEqual([
      'WRITE_AUDIT',
      'PERSIST_ALERT_RECORD',
      'EMIT_ALERT_ACTIVE',
    ]);
  });

  it('emits no effects when elapsed is 1 ms below threshold (T+14:59:59.999)', () => {
    const effects = evaluateDetection(DOSE, INACTIVE, CONFIG, BELOW_THRESHOLD, EVENT_ID);

    expect(effects).toHaveLength(0);
  });

  it('emits no effects when elapsed is 0 ms (dose just scheduled)', () => {
    const effects = evaluateDetection(DOSE, INACTIVE, CONFIG, AT_SCHEDULED, EVENT_ID);

    expect(effects).toHaveLength(0);
  });

  it('emits no effects when now is 1 ms before scheduledAt (future dose)', () => {
    const effects = evaluateDetection(DOSE, INACTIVE, CONFIG, BEFORE_SCHEDULED, EVENT_ID);

    expect(effects).toHaveLength(0);
  });

  it('emits effects when elapsed is well past threshold (T+25:00)', () => {
    const effects = evaluateDetection(DOSE, INACTIVE, CONFIG, WELL_PAST, EVENT_ID);

    expect(effects).toHaveLength(3);
  });

  it('respects a custom threshold of 1 minute', () => {
    const shortConfig: AlertThresholdConfig = {
      alertThresholdMinutes:      1,
      escalationThresholdMinutes: 10,
    };
    const justOver  = new Date(SCHEDULED_AT.getTime() + 60_000);
    const justUnder = new Date(SCHEDULED_AT.getTime() + 60_000 - 1);

    expect(evaluateDetection(DOSE, INACTIVE, shortConfig, justOver,  EVENT_ID)).toHaveLength(3);
    expect(evaluateDetection(DOSE, INACTIVE, shortConfig, justUnder, EVENT_ID)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// REQ-002: ALERT_ACTIVE payload contains patientId, medicationName, alertedAt
// ---------------------------------------------------------------------------

describe('REQ-002: ALERT_ACTIVE payload contains patientId, medicationName, alertedAt', () => {
  let effects: Effect[];

  beforeEach(() => {
    effects = evaluateDetection(DOSE, INACTIVE, CONFIG, AT_THRESHOLD, EVENT_ID);
  });

  it('EMIT_ALERT_ACTIVE carries correct patientId', () => {
    const emit = findEffect(effects, 'EMIT_ALERT_ACTIVE');
    expect(emit).toBeDefined();
    expect(emit!.record.patientId).toBe(PATIENT_ID);
  });

  it('EMIT_ALERT_ACTIVE carries correct medicationName', () => {
    const emit = findEffect(effects, 'EMIT_ALERT_ACTIVE');
    expect(emit!.record.medicationName).toBe('Metformin 500mg');
  });

  it('EMIT_ALERT_ACTIVE sets alertedAt to the injected now', () => {
    const emit = findEffect(effects, 'EMIT_ALERT_ACTIVE');
    expect(emit!.record.alertedAt).toBe(AT_THRESHOLD);
  });

  it('EMIT_ALERT_ACTIVE carries correct doseId', () => {
    const emit = findEffect(effects, 'EMIT_ALERT_ACTIVE');
    expect(emit!.record.doseId).toBe(DOSE_ID);
  });

  it('WRITE_AUDIT entry has actorId "system"', () => {
    const audit = findEffect(effects, 'WRITE_AUDIT');
    expect(audit!.entry.actorId).toBe('system');
  });

  it('WRITE_AUDIT entry has canonical transition string', () => {
    const audit = findEffect(effects, 'WRITE_AUDIT');
    expect(audit!.entry.transition).toBe('INACTIVE → ALERT_ACTIVE');
  });

  it('WRITE_AUDIT timestamp is ISO 8601 UTC with Z suffix matching injected now', () => {
    const audit = findEffect(effects, 'WRITE_AUDIT');
    expect(audit!.entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(audit!.entry.timestamp).toBe(AT_THRESHOLD.toISOString());
  });

  it('WRITE_AUDIT entry uses the injected eventId', () => {
    const audit = findEffect(effects, 'WRITE_AUDIT');
    expect(audit!.entry.eventId).toBe(EVENT_ID);
  });

  it('WRITE_AUDIT payload includes elapsedMs as a number', () => {
    const audit = findEffect(effects, 'WRITE_AUDIT');
    expect(audit!.entry.payload).toHaveProperty('elapsedMs');
    expect(typeof audit!.entry.payload['elapsedMs']).toBe('number');
  });

  it('PERSIST_ALERT_RECORD carries the same object reference as EMIT_ALERT_ACTIVE', () => {
    const persist = findEffect(effects, 'PERSIST_ALERT_RECORD');
    const emit    = findEffect(effects, 'EMIT_ALERT_ACTIVE');
    expect(persist!.record).toBe(emit!.record);
  });

  it('effects are ordered WRITE_AUDIT → PERSIST_ALERT_RECORD → EMIT_ALERT_ACTIVE', () => {
    expect(effects[0]!.kind).toBe('WRITE_AUDIT');
    expect(effects[1]!.kind).toBe('PERSIST_ALERT_RECORD');
    expect(effects[2]!.kind).toBe('EMIT_ALERT_ACTIVE');
  });
});

// ---------------------------------------------------------------------------
// REQ-003: No duplicate ALERT_ACTIVE per dose event
// ---------------------------------------------------------------------------

describe('REQ-003: no duplicate ALERT_ACTIVE for same dose event', () => {
  const ACTIVE: Extract<AlertRecord, { kind: 'ALERT_ACTIVE' }> = Object.freeze({
    kind:           'ALERT_ACTIVE',
    doseId:         DOSE_ID,
    patientId:      PATIENT_ID,
    medicationName: 'Metformin 500mg',
    scheduledAt:    SCHEDULED_AT,
    alertedAt:      AT_THRESHOLD,
  });

  const ESCALATED: Extract<AlertRecord, { kind: 'ALERT_ESCALATED' }> = Object.freeze({
    kind:           'ALERT_ESCALATED',
    doseId:         DOSE_ID,
    patientId:      PATIENT_ID,
    medicationName: 'Metformin 500mg',
    scheduledAt:    SCHEDULED_AT,
    alertedAt:      AT_THRESHOLD,
    escalatedAt:    new Date(AT_THRESHOLD.getTime() + 10 * 60 * 1000),
  });

  const ACKNOWLEDGED: Extract<AlertRecord, { kind: 'ACKNOWLEDGED' }> = Object.freeze({
    kind:            'ACKNOWLEDGED',
    doseId:          DOSE_ID,
    patientId:       PATIENT_ID,
    medicationName:  'Metformin 500mg',
    scheduledAt:     SCHEDULED_AT,
    alertedAt:       AT_THRESHOLD,
    acknowledgedAt:  WELL_PAST,
    acknowledgedBy:  'nurse-007' as ActorId,
  });

  it('returns [] when current state is ALERT_ACTIVE', () => {
    expect(evaluateDetection(DOSE, ACTIVE, CONFIG, WELL_PAST, EVENT_ID)).toHaveLength(0);
  });

  it('returns [] when current state is ALERT_ESCALATED', () => {
    expect(evaluateDetection(DOSE, ESCALATED, CONFIG, WELL_PAST, EVENT_ID)).toHaveLength(0);
  });

  it('returns [] when current state is ACKNOWLEDGED', () => {
    expect(evaluateDetection(DOSE, ACKNOWLEDGED, CONFIG, WELL_PAST, EVENT_ID)).toHaveLength(0);
  });

  it('never emits EMIT_ALERT_ACTIVE for any non-INACTIVE state', () => {
    for (const current of [ACTIVE, ESCALATED, ACKNOWLEDGED] as AlertRecord[]) {
      const effects = evaluateDetection(DOSE, current, CONFIG, WELL_PAST, EVENT_ID);
      expect(
        effects.some((e) => e.kind === 'EMIT_ALERT_ACTIVE'),
        `expected no EMIT_ALERT_ACTIVE for state ${current.kind}`,
      ).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// REQ-010: Determinism — same inputs always produce same outputs
// ---------------------------------------------------------------------------

describe('REQ-010: determinism — same inputs always produce same outputs', () => {
  it('returns deeply equal effects on two calls with identical inputs', () => {
    const first  = evaluateDetection(DOSE, INACTIVE, CONFIG, AT_THRESHOLD, EVENT_ID);
    const second = evaluateDetection(DOSE, INACTIVE, CONFIG, AT_THRESHOLD, EVENT_ID);

    expect(first).toEqual(second);
  });

  it('returns a new array reference on each call (no cached mutable state)', () => {
    const first  = evaluateDetection(DOSE, INACTIVE, CONFIG, AT_THRESHOLD, EVENT_ID);
    const second = evaluateDetection(DOSE, INACTIVE, CONFIG, AT_THRESHOLD, EVENT_ID);

    expect(first).not.toBe(second);
  });

  it('does not throw when all inputs are frozen', () => {
    const frozenDose    = Object.freeze({ ...DOSE, scheduledAt: new Date(DOSE.scheduledAt.getTime()) });
    const frozenConfig  = Object.freeze({ ...CONFIG });
    const frozenCurrent = Object.freeze({ ...INACTIVE });

    expect(() =>
      evaluateDetection(frozenDose, frozenCurrent, frozenConfig, AT_THRESHOLD, EVENT_ID),
    ).not.toThrow();
  });

  it('both calls with below-threshold now return empty arrays', () => {
    expect(evaluateDetection(DOSE, INACTIVE, CONFIG, BELOW_THRESHOLD, EVENT_ID)).toEqual([]);
    expect(evaluateDetection(DOSE, INACTIVE, CONFIG, BELOW_THRESHOLD, EVENT_ID)).toEqual([]);
  });

  it('different eventId values produce different WRITE_AUDIT eventIds but otherwise equal effects', () => {
    const id2     = '00000000-0000-0000-0000-000000000002' as EventId;
    const first   = evaluateDetection(DOSE, INACTIVE, CONFIG, AT_THRESHOLD, EVENT_ID);
    const second  = evaluateDetection(DOSE, INACTIVE, CONFIG, AT_THRESHOLD, id2);

    const audit1 = findEffect(first,  'WRITE_AUDIT')!;
    const audit2 = findEffect(second, 'WRITE_AUDIT')!;

    expect(audit1.entry.eventId).toBe(EVENT_ID);
    expect(audit2.entry.eventId).toBe(id2);
    expect(audit1.entry.transition).toBe(audit2.entry.transition);
  });
});
