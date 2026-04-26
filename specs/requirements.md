# Requirements Registry & Traceability Matrix
# Overdue Dose Alert with Escalation

**Feature**: `001-overdue-dose-alert`
**Spec**: [spec.md](./001-overdue-dose-alert/spec.md)
**Standard**: IEC 62304 Class B — §5.5.5 Software Unit Verification
**Last updated**: 2026-04-21

---

## Status key

| Symbol | Meaning |
|--------|---------|
| ✅ COMPLETE | Implementation merged, describe block present, tests pass |
| ⚠️ PARTIAL  | Implementation exists for some callers; remaining tasks are pending |
| ⏳ PENDING  | Source file not yet created (task not started) |

---

## Traceability Matrix

| REQ    | Requirement Summary | Implementing Function | Source File | Test File | `describe` Block | Status |
|--------|--------------------|-----------------------|-------------|-----------|-----------------|--------|
| REQ-001 | Detect unacknowledged dose past configurable alert threshold (default 15 min) | `evaluateDetection` | `src/engine/detect.ts` | `tests/unit/engine/detect.test.ts` | `'REQ-001: detect overdue dose at threshold boundary'` | ✅ COMPLETE |
| REQ-002 | Emit `ALERT_ACTIVE` with patientId, medicationName, and elapsed time | `evaluateDetection` | `src/engine/detect.ts` | `tests/unit/engine/detect.test.ts` | `'REQ-002: ALERT_ACTIVE payload contains patientId, medicationName, alertedAt'` | ✅ COMPLETE |
| REQ-003 | Never emit more than one `ALERT_ACTIVE` per dose event | `evaluateDetection` | `src/engine/detect.ts` | `tests/unit/engine/detect.test.ts` | `'REQ-003: no duplicate ALERT_ACTIVE for same dose event'` | ✅ COMPLETE |
| REQ-004 | Escalate to charge nurse after configurable escalation window (default 10 min) | `evaluateEscalation` | `src/engine/escalate.ts` | `tests/unit/engine/escalate.test.ts` | `'REQ-004: escalate to charge nurse after escalation threshold'` | ⏳ PENDING |
| REQ-005 | Never emit more than one `ALERT_ESCALATED` per dose event | `evaluateEscalation` | `src/engine/escalate.ts` | `tests/unit/engine/escalate.test.ts` | `'REQ-005: no duplicate ALERT_ESCALATED for same dose event'` | ⏳ PENDING |
| REQ-006 | Every state transition recorded as append-only audit entry with UTC timestamp and actor ID | `evaluateDetection`, `evaluateEscalation`, `evaluateAcknowledgment` | `src/engine/detect.ts`, `src/engine/escalate.ts`, `src/engine/acknowledge.ts` | `tests/unit/engine/detect.test.ts`, `tests/unit/engine/escalate.test.ts`, `tests/unit/engine/acknowledge.test.ts` | `'REQ-002: …'` (detect); `'REQ-006: …'` (acknowledge) | ⚠️ PARTIAL |
| REQ-007 | Reject and log any acknowledgment with empty or absent actor ID | `evaluateAcknowledgment` | `src/engine/acknowledge.ts` | `tests/unit/engine/acknowledge.test.ts` | `'REQ-007: reject anonymous acknowledgment'` | ⏳ PENDING |
| REQ-008 | Valid acknowledgment closes alert and prevents further escalation | `evaluateAcknowledgment` | `src/engine/acknowledge.ts` | `tests/unit/engine/acknowledge.test.ts` | `'REQ-008: valid ack transitions to ACKNOWLEDGED and stops escalation'` | ⏳ PENDING |
| REQ-009 | On any internal error, surface `SYSTEM_ALERT` — never suppress silently | `withFailSafe` | `src/shell/error-boundary.ts` | `tests/unit/shell/error-boundary.test.ts` | `'REQ-009: fail-safe — no silent error suppression'` | ⏳ PENDING |
| REQ-010 | All detection and escalation functions are deterministic (pure, injected time) | `evaluateDetection`, `evaluateEscalation`, `evaluateAcknowledgment` | `src/engine/detect.ts`, `src/engine/escalate.ts`, `src/engine/acknowledge.ts` | `tests/unit/engine/detect.test.ts`, `tests/unit/engine/escalate.test.ts`, `tests/unit/engine/acknowledge.test.ts` | `'REQ-010: determinism — same inputs always produce same outputs'` | ⚠️ PARTIAL |
| REQ-011 | Alert threshold validated as positive integer at startup; invalid value causes startup failure | `validateConfig` | `src/engine/config-validator.ts` | `tests/unit/engine/config-validator.test.ts` | `'REQ-011: alertThresholdMinutes validated at config load'` | ✅ COMPLETE |
| REQ-012 | Escalation threshold validated as positive integer at startup; combined sum must not overflow | `validateConfig` | `src/engine/config-validator.ts` | `tests/unit/engine/config-validator.test.ts` | `'REQ-012: escalationThresholdMinutes validated at config load'` | ✅ COMPLETE |

---

## Requirement Definitions

### REQ-001
The system MUST detect any scheduled dose that has no administration record within a
configurable threshold (default 15 minutes) of its scheduled time.

**Hazard link**: Undetected overdue dose → patient harm from missed medication.
**Boundary tested**: T+14:59.999 (no alert) and T+15:00.000 (alert fires).

### REQ-002
On detecting an overdue dose, the system MUST emit an `ALERT_ACTIVE` event containing
the patient ID, medication name, and elapsed time since the dose was due.

**Hazard link**: Incomplete alert payload → care team unable to identify correct patient or medication.

### REQ-003
The system MUST NOT emit more than one `ALERT_ACTIVE` event per unique dose event,
regardless of how frequently the detection function is evaluated.

**Hazard link**: Duplicate alerts → alert fatigue → care team ignores real alerts.

### REQ-004
If an `ALERT_ACTIVE` event remains unacknowledged for a configurable escalation period
(default: 10 minutes after the alert was raised), the system MUST emit an
`ALERT_ESCALATED` event to the charge-nurse role.

**Hazard link**: Alert missed by primary care team → dose remains unaddressed.

### REQ-005
The system MUST NOT emit more than one `ALERT_ESCALATED` event per unique dose event.

**Hazard link**: Duplicate escalations → alert fatigue at charge-nurse level.

### REQ-006
Every state transition (INACTIVE → ALERT_ACTIVE → ALERT_ESCALATED → ACKNOWLEDGED) MUST
be recorded as an append-only audit entry containing a UTC timestamp, a non-empty actor
ID, and a transition description.

**Regulatory link**: 21 CFR Part 11 — attributable, legible, contemporaneous, accurate records.

### REQ-007
An acknowledgment MUST be rejected and the attempt logged if the submitted actor ID is
empty, null, or absent.

**Regulatory link**: 21 CFR Part 11 — records must be attributable to a specific individual.

### REQ-008
A valid acknowledgment (non-empty actor ID) MUST transition the alert to `ACKNOWLEDGED`
and prevent any further escalation for that dose event.

**Hazard link**: Unresolved alert → continued escalation of an already-handled event.

### REQ-009
On any internal error during detection, escalation evaluation, or acknowledgment
processing, the system MUST surface a `SYSTEM_ALERT` to the operator and MUST NOT
suppress or swallow the error silently.

**Hazard link**: Silent failure → system appears healthy while alerts are not being evaluated.
**Regulatory link**: ISO 14971 — residual risk controls depend on operator visibility.

### REQ-010
All detection and escalation functions MUST be deterministic: given identical inputs
(including injected current time) they MUST produce identical outputs with no side
effects.

**Regulatory link**: IEC 62304 §5.5 — test reproducibility requires deterministic units.

### REQ-011
The alert threshold MUST be validated as a positive integer at configuration load time;
an invalid value MUST cause a startup failure with a descriptive error.

**Hazard link**: Zero or negative threshold → alert fires immediately or never; silent misconfiguration.

### REQ-012
The escalation threshold MUST be validated as a positive integer at configuration load
time; the combined (alert + escalation) window MUST be computable without overflow.

**Hazard link**: Overflow threshold → escalation never fires; patient safety event unescalated.

---

## Progress summary

| Status | Count | REQs |
|--------|-------|------|
| ✅ COMPLETE | 5 | REQ-001, REQ-002, REQ-003, REQ-011, REQ-012 |
| ⚠️ PARTIAL  | 2 | REQ-006, REQ-010 |
| ⏳ PENDING  | 5 | REQ-004, REQ-005, REQ-007, REQ-008, REQ-009 |

Pending tasks: T029 (escalate.ts), T030 (escalate.test.ts), T027 (acknowledge.ts),
T028 (acknowledge.test.ts), T023 (error-boundary.ts), T026 (error-boundary.test.ts).
