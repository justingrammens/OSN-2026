# Feature Specification: Overdue Dose Alert with Escalation

**Feature Branch**: `001-overdue-dose-alert`
**Created**: 2026-04-20
**Status**: Draft
**Input**: User description: "Overdue Dose Alert with Escalation"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Care Team Receives Overdue Dose Alert (Priority: P1)

A nurse is responsible for administering a scheduled medication. The dose time passes
and no administration is recorded. Fifteen minutes later the care team receives an
alert identifying the patient, the medication, and how long the dose has been overdue,
so they can investigate and act before patient harm occurs.

**Why this priority**: This is the core value of the system. Without it no other
story matters. It directly prevents the silent-failure mode identified in the
objective.

**Independent Test**: Create a scheduled dose event, advance simulated time 15 minutes
past the due time, run the detection function — a care-team alert MUST be emitted and
an audit entry MUST be recorded. No external services required.

**Acceptance Scenarios**:

1. **Given** a dose scheduled at T=0 with no administration record,
   **When** the detection function is evaluated at T=15 min,
   **Then** an `ALERT_ACTIVE` event is emitted containing patient ID, medication name,
   and elapsed time of 15 minutes, and an audit entry is written with UTC timestamp
   and `actorId: "system"`.

2. **Given** a dose scheduled at T=0 with no administration record,
   **When** the detection function is evaluated at T=14 min 59 sec,
   **Then** no alert is emitted (threshold not yet crossed).

3. **Given** an alert already active for a specific dose event,
   **When** the detection function is evaluated again,
   **Then** no duplicate alert is emitted for the same dose event.

4. **Given** an internal error occurs during detection,
   **When** the detection function is evaluated,
   **Then** a `SYSTEM_ALERT` is surfaced to the operator and the error is logged to
   the audit trail — no silent failure.

---

### User Story 2 — Escalation to Charge Nurse (Priority: P2)

An active overdue-dose alert has not been acknowledged within 10 minutes of being
raised. The system automatically escalates to the charge nurse, who receives the same
contextual information plus the total elapsed time since the original dose was due.

**Why this priority**: Escalation is the safety net when the first alert is missed.
It directly mitigates the risk of a dose going completely unnoticed during a busy
shift.

**Independent Test**: Create an active alert, advance simulated time 10 minutes past
the alert-raised timestamp, run the escalation function — a charge-nurse escalation
event MUST be emitted and an audit entry MUST be recorded.

**Acceptance Scenarios**:

1. **Given** an `ALERT_ACTIVE` event raised at T=0 with no acknowledgment,
   **When** the escalation function is evaluated at T=10 min,
   **Then** an `ALERT_ESCALATED` event is emitted to the charge-nurse role, including
   patient ID, medication name, and total elapsed time since the dose was due, and an
   audit entry is written.

2. **Given** an `ALERT_ACTIVE` event raised at T=0 with no acknowledgment,
   **When** the escalation function is evaluated at T=9 min 59 sec,
   **Then** no escalation is emitted (threshold not yet crossed).

3. **Given** an alert already in `ALERT_ESCALATED` state,
   **When** the escalation function is evaluated again,
   **Then** no duplicate escalation is emitted.

---

### User Story 3 — Authenticated Acknowledgment Closes the Alert (Priority: P1)

A care team member or charge nurse acknowledges the alert using their authenticated
identity. The system validates that the acknowledgment carries a non-empty actor ID,
transitions the alert to `ACKNOWLEDGED`, and records the event. Anonymous or
unauthenticated acknowledgments are rejected and the rejection is logged.

**Why this priority**: 21 CFR Part 11 and the Immutable Audit principle require that
every state transition be attributed to a specific actor. An unattributed
acknowledgment is not a valid acknowledgment.

**Independent Test**: Submit an acknowledgment with a valid actor ID — alert state
transitions to `ACKNOWLEDGED` and audit entry is written. Submit an acknowledgment
with an empty/missing actor ID — rejection error returned and audit entry is written
with `actorId: "system"` recording the anonymous attempt.

**Acceptance Scenarios**:

1. **Given** an `ALERT_ACTIVE` or `ALERT_ESCALATED` alert,
   **When** an authenticated user (non-empty actor ID) submits an acknowledgment,
   **Then** the alert transitions to `ACKNOWLEDGED`, an audit entry is written with
   the actor's ID and a UTC timestamp, and no further escalation occurs.

2. **Given** an `ALERT_ACTIVE` or `ALERT_ESCALATED` alert,
   **When** an acknowledgment with an empty or absent actor ID is submitted,
   **Then** the acknowledgment is rejected with an explicit error, an audit entry
   records the anonymous attempt with `actorId: "system"`, and the alert remains
   in its current state.

3. **Given** an `ACKNOWLEDGED` alert,
   **When** any acknowledgment is submitted,
   **Then** a no-op response is returned (idempotent) and no duplicate audit entry
   is written.

---

### Edge Cases

- What happens when the configurable alert threshold is set to 0 or a negative value?
  The threshold MUST be validated as a positive integer at configuration load time;
  invalid values MUST cause a startup failure with a descriptive error, not a runtime
  silent failure.
- What happens when a dose record arrives for a dose that already has an active alert?
  The alert transitions to `ACKNOWLEDGED` only via explicit authenticated
  acknowledgment; a late administration record alone does not close the alert
  (regulatory requirement for human sign-off).
- What happens when the audit log write fails during a state transition?
  The state transition is rolled back; the system emits a `SYSTEM_ALERT` — a
  transition MUST NOT be committed without its corresponding audit record.
- What happens when two evaluation cycles detect the same dose as overdue simultaneously?
  The duplicate-suppression invariant (REQ-003, REQ-005) MUST hold; idempotency is
  enforced at the state-transition level, not merely at the caller level.

## Requirements *(mandatory)*

### Functional Requirements

- **REQ-001**: The system MUST detect any scheduled dose that has no administration
  record within a configurable threshold (default 15 minutes) of its scheduled time.

- **REQ-002**: On detecting an overdue dose, the system MUST emit an `ALERT_ACTIVE`
  event containing the patient ID, medication name, and elapsed time since the dose
  was due.

- **REQ-003**: The system MUST NOT emit more than one `ALERT_ACTIVE` event per unique
  dose event, regardless of evaluation frequency.

- **REQ-004**: If an `ALERT_ACTIVE` event remains unacknowledged for a configurable
  escalation period (default 10 minutes after the alert was raised), the system MUST
  emit an `ALERT_ESCALATED` event to the charge-nurse role.

- **REQ-005**: The system MUST NOT emit more than one `ALERT_ESCALATED` event per
  unique dose event.

- **REQ-006**: Every state transition (INACTIVE → ALERT_ACTIVE → ALERT_ESCALATED →
  ACKNOWLEDGED) MUST be recorded as an append-only audit entry containing a UTC
  timestamp, a non-empty actor ID, and a transition description.

- **REQ-007**: An acknowledgment MUST be rejected and the attempt logged if the
  submitted actor ID is empty, null, or absent.

- **REQ-008**: A valid acknowledgment (non-empty actor ID) MUST transition the alert
  to `ACKNOWLEDGED` and prevent any further escalation for that dose event.

- **REQ-009**: On any internal error during detection, escalation evaluation, or
  acknowledgment processing, the system MUST surface a `SYSTEM_ALERT` to the operator
  and MUST NOT suppress or swallow the error silently.

- **REQ-010**: All detection and escalation functions MUST be deterministic: given
  identical inputs (including injected current time) they MUST produce identical
  outputs with no side effects.

- **REQ-011**: The alert threshold MUST be validated as a positive integer at
  configuration load time; an invalid value MUST cause a startup failure with a
  descriptive error.

- **REQ-012**: The escalation threshold MUST be validated as a positive integer at
  configuration load time; the combined (alert + escalation) window MUST be
  computable without overflow.

### Key Entities

- **DoseEvent**: Represents a single scheduled medication administration instance.
  Attributes: unique dose ID, patient ID, medication name, scheduled time.
  Immutable once created.

- **AlertState**: Discriminated union representing the full lifecycle of an alert for
  a given dose event. Variants: `INACTIVE`, `ALERT_ACTIVE`, `ALERT_ESCALATED`,
  `ACKNOWLEDGED`. Transitions are one-directional and append-only.

- **AuditEntry**: An immutable record of a single state transition or system event.
  Attributes: event ID (UUID), UTC timestamp, actor ID, transition description,
  and a serializable payload snapshot.

- **AlertThresholdConfig**: Configuration record holding the alert threshold (minutes)
  and escalation threshold (minutes). Validated at load time before any processing.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An overdue dose is detected and an alert raised within one evaluation
  cycle of the threshold being crossed — zero missed detections in a compliant
  environment.

- **SC-002**: No duplicate alerts or escalations are generated for the same dose event
  under any evaluation frequency — zero duplicates across all test runs including
  boundary-value and concurrent-evaluation scenarios.

- **SC-003**: Every state transition produces a corresponding audit entry — audit
  completeness rate is 100%; no transition is committed without an audit record.

- **SC-004**: Anonymous acknowledgment attempts are rejected 100% of the time — zero
  unauthenticated acknowledgments are accepted.

- **SC-005**: In error-injection test scenarios, zero errors are silently suppressed —
  every injected fault results in a visible `SYSTEM_ALERT` and a logged audit entry.

- **SC-006**: All detection and escalation functions pass determinism verification:
  repeated calls with identical inputs produce identical outputs with no observable
  state mutation outside the audit log.

- **SC-007**: The traceability matrix (REQ-NNN → function → test → status) is complete
  and machine-verifiable — zero requirements lack a corresponding test suite entry.

## Assumptions

- The delivery of alerts to care team endpoints (pager, EHR notification, mobile push)
  is handled by an external notification service injected as a dependency; this
  feature produces alert events but does not implement delivery.
- "Authenticated actor ID" is provided by the calling authentication layer; this
  feature validates presence and non-emptiness but does not implement authentication.
- Dose events are created by an upstream scheduling system and delivered as immutable
  records; this feature does not create or modify dose records.
- The evaluation cadence (how frequently detection/escalation functions are invoked)
  is controlled by an external scheduler; the functions themselves are stateless
  and pure.
- The append-only audit store is an injected dependency; this feature writes to it
  but does not implement the storage backend.
- All time values are UTC; this feature contains no locale or timezone logic.
- The charge-nurse role identifier is a well-known constant resolvable by the
  notification service; this feature passes the role identifier, not a specific
  named user.
