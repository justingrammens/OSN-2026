---
description: "Task list for Overdue Dose Alert with Escalation"
---

# Tasks: Overdue Dose Alert with Escalation

**Input**: Design documents from `/specs/001-overdue-dose-alert/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅
**Sequencing**: types → state engine functions → test suite → alert dispatcher → notifier stub → traceability matrix
**Tests**: Included — spec.md VERIFICATION section explicitly requires `describe('REQ-NNN')` blocks

## Format: `[ID] [P?] [Story] Description — REQ-NNN | file path | acceptance criteria`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- REQ-NNN identifiers, file paths, and acceptance criteria are embedded in each task description

---

## Phase 1: Setup (Project Scaffolding)

**Purpose**: Initialize the repository with Node.js 20 LTS, TypeScript strict mode, Vitest,
ESLint safety rules, and the database migration for the three PostgreSQL tables.

- [ ] T001 Initialize Node.js 20 LTS project: create `package.json` with `"engines": {"node": ">=20"}`, pnpm workspace, and scripts `test`, `test:unit`, `test:integration`, `check`, `check:traceability`, `check:audit-integrity`, `db:migrate`

- [ ] T002 [P] Create `tsconfig.json` with `"strict": true`, `"noUncheckedIndexedAccess": true`, `"exactOptionalPropertyTypes": true`, target `ES2022`, module `Node16` — zero TypeScript errors is the acceptance criterion (tsc --noEmit must pass)

- [ ] T003 [P] Configure ESLint in `.eslintrc.cjs`: extend `@typescript-eslint/recommended-type-checked`; add `no-restricted-syntax` banning `Date.now()` and `new Date()` inside `src/engine/` and `src/shell/`; set `@typescript-eslint/no-explicit-any: error`; set `@typescript-eslint/switch-exhaustiveness-check: error` — acceptance: `eslint src/` reports zero errors

- [ ] T004 [P] Configure Vitest in `vitest.config.ts`: set `coverage.provider: "v8"`, `coverage.thresholds.statements: 90`, `coverage.include: ["src/**"]`, `test.include: ["tests/unit/**/*.test.ts"]` — acceptance: `vitest run --coverage` enforces ≥90% statement coverage gate

- [ ] T005 [P] Create directory structure: `src/types/`, `src/ports/`, `src/engine/`, `src/shell/`, `src/adapters/`, `tests/unit/engine/`, `tests/unit/shell/`, `tests/fakes/`, `tests/integration/`

- [ ] T006 Create database migration `migrations/001_initial_schema.sql`: tables `dose_events` (SELECT only for app role), `alert_snapshots` (INSERT/SELECT/UPDATE, no DELETE, status CHECK constraint), `audit_log` (INSERT/SELECT only, no UPDATE/DELETE, `actor_id <> ''` CHECK, `gen_random_uuid()` default) — acceptance: migration runs cleanly; `\dp audit_log` confirms no UPDATE/DELETE privilege

- [ ] T007 Add `pnpm check:traceability` script to `package.json` that greps all exported functions in `src/` for `@satisfies REQ-` annotations and exits non-zero if any exported function is missing one — acceptance: script catches a deliberately un-annotated function

---

## Phase 2: Foundational (Types → Port Interfaces → Shared Test Fakes)

**Purpose**: All TypeScript types, port interfaces, and shared test fakes must be complete
before any user story engine function or test can be written.

⚠️ **CRITICAL**: No user story work begins until this phase is complete.

### Types (all files independent — run in parallel)

- [ ] T008 [P] Define branded primitive types in `src/types/domain.ts`: `DoseId`, `PatientId`, `ActorId`, `EventId` (all `string & { readonly __brand: '...' }`), `AlertStatus` union literal — no REQ directly; foundational for type-safety across all REQ

- [ ] T009 [P] Define `AlertRecord` discriminated union in `src/types/alert-record.ts`: four `readonly` variants (`INACTIVE`, `ALERT_ACTIVE`, `ALERT_ESCALATED`, `ACKNOWLEDGED`) using `kind` discriminant; `ACKNOWLEDGED` variant includes optional `escalatedAt?` — satisfies REQ-003, REQ-005 (illegal state transitions unrepresentable at compile time); acceptance: `tsc --noEmit` passes with exhaustive switch on `AlertRecord`

- [ ] T010 [P] Define `AuditEntry` interface in `src/types/audit-entry.ts`: fields `eventId: EventId`, `timestamp: string` (ISO 8601 UTC), `actorId: ActorId`, `transition: string`, `doseId: DoseId`, `payload: Readonly<Record<string, unknown>>` — satisfies REQ-006; acceptance: interface cannot be constructed with empty `actorId` (branded type prevents it at compile time)

- [ ] T011 [P] Define `AlertThresholdConfig` interface in `src/types/config.ts`: `alertThresholdMinutes: number`, `escalationThresholdMinutes: number`, both `readonly` — satisfies REQ-011, REQ-012; acceptance: interface is structurally correct per data-model.md

- [ ] T012 [P] Define `Effect` discriminated union in `src/types/effects.ts`: five variants (`EMIT_ALERT_ACTIVE`, `EMIT_ALERT_ESCALATED`, `EMIT_SYSTEM_ALERT`, `WRITE_AUDIT`, `PERSIST_ALERT_RECORD`) using `kind` discriminant and `readonly` payloads — satisfies REQ-002, REQ-004, REQ-009; acceptance: exhaustive switch compiles with `never` guard

### Port interfaces (depend on T008–T012)

- [ ] T013 [P] Define `AuditRepository` interface in `src/ports/audit-repository.ts`: methods `append(entry: AuditEntry): Promise<void>` and `findByDoseId(doseId: DoseId): Promise<readonly AuditEntry[]>` — satisfies REQ-006; acceptance: interface has no UPDATE/DELETE methods

- [ ] T014 [P] Define `AlertRepository` interface in `src/ports/alert-repository.ts`: methods `findByDoseId(doseId: DoseId): Promise<AlertRecord | undefined>` and `save(record: AlertRecord): Promise<void>` — satisfies REQ-003, REQ-005; acceptance: interface compiles against types from T008–T009

- [ ] T015 [P] Define `Notifier` interface in `src/ports/notifier.ts`: methods `dispatchAlertActive(record: Extract<AlertRecord, { kind: 'ALERT_ACTIVE' }>): Promise<void>`, `dispatchAlertEscalated(record: Extract<AlertRecord, { kind: 'ALERT_ESCALATED' }>): Promise<void>`, `dispatchSystemAlert(error: Error, context: string): Promise<void>` — satisfies REQ-002, REQ-004, REQ-009; acceptance: narrowed `Extract<>` types prevent passing wrong variant

- [ ] T016 Create barrel export `src/index.ts` re-exporting all public types and interfaces from `src/types/` and `src/ports/` — acceptance: `import { AlertRecord, AuditRepository, Notifier } from './index'` resolves with no errors

### Shared test fakes (depend on T013–T015; shared by all user story test suites)

- [ ] T017 [P] Implement `InMemoryAuditRepository` and `InMemoryAlertRepository` in `tests/fakes/in-memory-repositories.ts`: both implement port interfaces from T013–T014; `InMemoryAuditRepository.append()` pushes to an internal array (append-only — no `splice()`/`delete`); `findByDoseId()` filters by doseId — satisfies REQ-006 test support; acceptance: both satisfy their interface contracts verified by TypeScript compiler

- [ ] T018 [P] Implement `RecordingNotifier` in `tests/fakes/recording-notifier.ts`: implements `Notifier`; captures each dispatched event in typed arrays `dispatchedAlerts`, `dispatchedEscalations`, `dispatchedSystemAlerts`; provides `reset()` helper — satisfies REQ-002, REQ-004, REQ-009 test support; acceptance: a test can assert `notifier.dispatchedAlerts.length === 1` after firing detection

**Checkpoint — Foundation ready**: `tsc --noEmit` and `eslint src/` pass. All port interfaces and test fakes are complete. User story phases can now proceed in parallel.

---

## Phase 3: User Story 1 — Care Team Alert (Priority: P1) 🎯 MVP

**Goal**: When a dose is overdue by ≥ alertThresholdMinutes, a care-team alert fires
with patient ID, medication name, and elapsed time. Duplicate alerts for the same dose
are suppressed. Internal errors surface as SYSTEM_ALERTs.

**Independent Test**: `vitest run tests/unit/engine/detect.test.ts tests/unit/engine/config-validator.test.ts tests/unit/shell/error-boundary.test.ts`

### State engine functions

- [ ] T019 [US1] Implement `validateConfig(config: unknown): AlertThresholdConfig` in `src/engine/config-validator.ts` — `@satisfies REQ-011, REQ-012`; throws typed `ConfigValidationError` (with descriptive message) if `alertThresholdMinutes` or `escalationThresholdMinutes` ≤ 0, not an integer, or would overflow when added; acceptance criteria from spec: invalid threshold causes startup failure with descriptive error, never a silent runtime failure

- [ ] T020 [US1] Implement `evaluateDetection(dose: DoseEvent, current: AlertRecord, config: AlertThresholdConfig, now: Date): Effect[]` in `src/engine/detect.ts` — `@satisfies REQ-001, REQ-002, REQ-003, REQ-010`; pure function — no imports from `src/ports/` or `src/adapters/`; returns `[WRITE_AUDIT, PERSIST_ALERT_RECORD, EMIT_ALERT_ACTIVE]` when `current.kind === 'INACTIVE'` and elapsed ≥ threshold; returns `[]` when `current.kind === 'ALERT_ACTIVE'` (REQ-003 duplicate suppression); acceptance criteria: given identical inputs returns identical outputs (REQ-010); elapsed 14:59 → no effects, elapsed 15:00 → effects

### Test suite for US1

- [ ] T021 [US1] Write `tests/unit/engine/detect.test.ts` with:
  - `describe('REQ-001: detect overdue dose at threshold boundary')` — `it('emits ALERT_ACTIVE at T=15:00')`, `it('emits nothing at T=14:59')`, `it('emits nothing when elapsed is exactly 0')`
  - `describe('REQ-002: ALERT_ACTIVE payload contains patientId, medicationName, elapsedTime')` — asserts all three fields present in emitted record
  - `describe('REQ-003: no duplicate ALERT_ACTIVE for same dose event')` — passes ALERT_ACTIVE state as input; asserts returned effects array is empty
  - `describe('REQ-010: determinism — same inputs same outputs')` — calls evaluateDetection twice with identical frozen inputs; asserts deep equality
  - All tests use fakes from T017–T018; no real I/O; time injected via `now` parameter

- [ ] T022 [US1] Write `tests/unit/engine/config-validator.test.ts` with:
  - `describe('REQ-011: alertThresholdMinutes validated at config load')` — boundary: 0 throws, 1 passes, -1 throws, 1.5 throws (non-integer), MAX_SAFE_INTEGER passes
  - `describe('REQ-012: escalationThresholdMinutes validated at config load')` — same boundaries; combined window overflow check

### Alert dispatcher

- [ ] T023 [US1] Implement `withFailSafe<T>(fn: () => Promise<T>, context: string, deps: FailSafeDeps): Promise<T | Effect[]>` in `src/shell/error-boundary.ts` — `@satisfies REQ-009`; on caught error: builds `EMIT_SYSTEM_ALERT` + `WRITE_AUDIT` effects with `actorId: 'system' as ActorId`; never rethrows silently; acceptance criteria from spec: every injected fault results in a visible SYSTEM_ALERT and audit entry

- [ ] T024 [US1] Implement `runEffects(effects: Effect[], deps: EffectRunnerDeps): Promise<void>` in `src/shell/effect-runner.ts` — `@satisfies REQ-002, REQ-004, REQ-006`; dispatches each effect in order: `WRITE_AUDIT` → `deps.audit.append()`, `PERSIST_ALERT_RECORD` → `deps.alerts.save()`, `EMIT_ALERT_ACTIVE` → `deps.notifier.dispatchAlertActive()`, `EMIT_SYSTEM_ALERT` → `deps.notifier.dispatchSystemAlert()`; exhaustive switch with `never` guard; acceptance: `eslint` switch-exhaustiveness-check passes

### Notifier stub (production adapter)

- [ ] T025 [P] [US1] Implement `HttpNotifier` in `src/adapters/http-notifier.ts` implementing `Notifier` interface: dispatches to downstream notification endpoint via HTTP POST using Node.js built-in `fetch`; logs delivery failure to stderr (does not throw — delivery failure is separate concern from alert generation) — satisfies REQ-002, REQ-004, REQ-009 production path; acceptance: implements all three Notifier methods; TypeScript compiler verifies structural conformance

### Error-boundary test suite

- [ ] T026 [US1] Write `tests/unit/shell/error-boundary.test.ts` with:
  - `describe('REQ-009: fail-safe — no silent error suppression')` — inject function that throws; assert `EMIT_SYSTEM_ALERT` present in returned effects; assert `WRITE_AUDIT` entry has `actorId: 'system'`; assert no silent catch (spy on console.error is NOT used — effects are the verification mechanism)
  - Uses `RecordingNotifier` from T018

**Checkpoint — US1 complete**: `vitest run tests/unit/engine/detect.test.ts tests/unit/engine/config-validator.test.ts tests/unit/shell/error-boundary.test.ts` passes. Duplicate suppression, fail-safe, and boundary detection all verified.

---

## Phase 4: User Story 3 — Authenticated Acknowledgment (Priority: P1)

**Goal**: A valid (non-empty actor ID) acknowledgment transitions the alert to ACKNOWLEDGED.
An anonymous acknowledgment is rejected and the rejection is logged to the audit trail.
Acknowledging an already-ACKNOWLEDGED alert is idempotent.

**Independent Test**: `vitest run tests/unit/engine/acknowledge.test.ts`

### State engine function

- [ ] T027 [US3] Implement `evaluateAcknowledgment(current: AlertRecord, actorId: string, now: Date): Effect[]` in `src/engine/acknowledge.ts` — `@satisfies REQ-007, REQ-008, REQ-006`; pure function; if `actorId.trim() === ''`: returns `[WRITE_AUDIT]` with rejection record (`transition: 'REJECTED_ANONYMOUS_ACK'`, `actorId: 'system' as ActorId`); if `current.kind === 'ACKNOWLEDGED'`: returns `[]` (idempotent); if `current.kind` is `ALERT_ACTIVE` or `ALERT_ESCALATED`: returns `[WRITE_AUDIT, PERSIST_ALERT_RECORD]` transitioning to ACKNOWLEDGED; throws `InvalidTransitionError` if called on INACTIVE state; acceptance criteria: anonymous attempt is rejected and logged (REQ-007); valid ack closes alert and prevents further escalation (REQ-008)

### Test suite for US3

- [ ] T028 [US3] Write `tests/unit/engine/acknowledge.test.ts` with:
  - `describe('REQ-007: reject anonymous acknowledgment')` — empty string rejected + WRITE_AUDIT emitted; whitespace-only string rejected; valid actorId accepted; boundary: single char actorId passes
  - `describe('REQ-008: valid ack transitions to ACKNOWLEDGED and stops escalation')` — ALERT_ACTIVE → ACKNOWLEDGED; ALERT_ESCALATED → ACKNOWLEDGED; resulting ACKNOWLEDGED record has correct `acknowledgedBy` and `acknowledgedAt`
  - `describe('REQ-006: every state transition produces audit entry')` — assert WRITE_AUDIT in effects for every valid transition; assert rejection record written for anonymous attempt
  - Idempotency case: ACKNOWLEDGED → ACKNOWLEDGED returns empty effects array

**Checkpoint — US3 complete**: `vitest run tests/unit/engine/acknowledge.test.ts` passes. All three acceptance scenarios from spec.md verified.

---

## Phase 5: User Story 2 — Escalation to Charge Nurse (Priority: P2)

**Goal**: An unacknowledged ALERT_ACTIVE that has aged ≥ escalationThresholdMinutes
triggers an ALERT_ESCALATED event to the charge-nurse role. Duplicate escalations for
the same dose are suppressed.

**Independent Test**: `vitest run tests/unit/engine/escalate.test.ts`

### State engine function

- [ ] T029 [US2] Implement `evaluateEscalation(current: AlertRecord, config: AlertThresholdConfig, now: Date): Effect[]` in `src/engine/escalate.ts` — `@satisfies REQ-004, REQ-005, REQ-010`; pure function; if `current.kind !== 'ALERT_ACTIVE'`: returns `[]`; if elapsed since `current.alertedAt` < `escalationThresholdMinutes`: returns `[]`; if elapsed ≥ threshold: returns `[WRITE_AUDIT, PERSIST_ALERT_RECORD, EMIT_ALERT_ESCALATED]`; `ALERT_ESCALATED` record includes `escalatedAt: now` and total elapsed since `scheduledAt`; acceptance criteria: `evaluateEscalation` on ALERT_ESCALATED returns [] (REQ-005 duplicate suppression); identical inputs always produce identical outputs (REQ-010)

### Test suite for US2

- [ ] T030 [US2] Write `tests/unit/engine/escalate.test.ts` with:
  - `describe('REQ-004: escalate to charge nurse after escalation threshold')` — ALERT_ACTIVE at T+9:59 → empty effects; ALERT_ACTIVE at T+10:00 → EMIT_ALERT_ESCALATED; emitted record contains patientId, medicationName, and total elapsed from scheduledAt
  - `describe('REQ-005: no duplicate ALERT_ESCALATED for same dose event')` — pass ALERT_ESCALATED as input; assert returned effects array is empty
  - `describe('REQ-010: determinism on escalation')` — call evaluateEscalation twice with identical frozen inputs; deep-equal results
  - Boundary cases: threshold=1 (minimum valid), elapsed exactly at boundary

**Checkpoint — US2 complete**: `vitest run tests/unit/engine/escalate.test.ts` passes. Escalation boundary and duplicate suppression verified.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: PostgreSQL adapters, integration tests, full quality gate run, and traceability matrix.

- [ ] T031 [P] Implement `PostgresAuditRepository` in `src/adapters/postgres-audit-repository.ts` implementing `AuditRepository` — `@satisfies REQ-006`; INSERT only (no UPDATE/DELETE methods on the class); uses parameterized queries (`$1`, `$2`, …) — no string interpolation; `append()` writes `eventId`, `timestamp`, `actorId`, `transition`, `doseId`, `payload` as JSONB; acceptance: INSERT succeeds; calling any non-existent UPDATE throws TypeScript compile error

- [ ] T032 [P] Implement `PostgresAlertRepository` in `src/adapters/postgres-alert-repository.ts` implementing `AlertRepository` — `@satisfies REQ-003, REQ-005`; `save()` uses `INSERT … ON CONFLICT (dose_id) DO UPDATE` for snapshot upsert; never decrements status (enforced by DB CHECK constraint from T006); acceptance: saves ALERT_ACTIVE; subsequent save with ACKNOWLEDGED does not regress to ALERT_ACTIVE

- [ ] T033 [P] Write `tests/integration/postgres-audit-repository.test.ts`: connects to test database; appends three entries; verifies `findByDoseId` returns all three in insertion order; verifies the DB-level `actor_id <> ''` CHECK constraint rejects empty actor via `expect(repo.append({…actorId: '' as ActorId…})).rejects.toThrow()`; verifies no UPDATE or DELETE SQL is constructible (compile-time check)

- [ ] T034 [P] Create `specs/requirements.md` traceability matrix table: columns `REQ-NNN | Requirement Summary | Implementing Function | File | Test File | describe Block | Status`; populate all 12 rows (REQ-001 through REQ-012) from plan.md traceability map; acceptance: `pnpm check:traceability` runs against this file and exits 0

- [ ] T035 Run `pnpm check` (sequential pipeline: `tsc --noEmit` → `eslint src/ tests/` → `vitest run --coverage` → `check:traceability` → `check:audit-integrity` → `pnpm audit --audit-level=high`); all gates must pass; acceptance criteria: zero TypeScript errors, zero ESLint errors, ≥90% statement coverage, no orphaned REQ-NNN annotations, audit integrity verified, no HIGH/CRITICAL vulnerabilities

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 (types + fakes). Blocks nothing downstream.
- **US3 (Phase 4)**: Depends on Phase 2. Independent of US1 (different engine file).
- **US2 (Phase 5)**: Depends on Phase 2. Independent of US1 and US3.
- **Polish (Phase 6)**: Depends on all user story phases being complete.

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2 — no dependency on US2 or US3
- **US3 (P1)**: Can start after Phase 2 — no dependency on US1 or US2
- **US2 (P2)**: Can start after Phase 2 — no dependency on US1 or US3

### Within Each User Story

- Engine function BEFORE its test suite (tests verify the function)
- Fakes (T017–T018) available before any test is written
- Config validator (T019) before detect (T020) — detect imports validateConfig
- Error boundary (T023) before effect runner (T024) — runner uses withFailSafe

### Parallel Opportunities

- T002–T005 (setup config files): all parallel
- T008–T012 (domain types): all parallel
- T013–T015 (port interfaces): all parallel after T008–T012
- T017–T018 (test fakes): parallel after T013–T015
- T019 and T023 within US1: parallel (different files)
- US1, US3, US2 phases: all three can start simultaneously once Phase 2 is done
- T031–T034 in Polish: all parallel

---

## Parallel Execution Example: Phase 2

```bash
# All types at once (different files, no inter-dependencies):
Task: "Define branded types in src/types/domain.ts"           # T008
Task: "Define AlertRecord union in src/types/alert-record.ts" # T009
Task: "Define AuditEntry interface in src/types/audit-entry.ts" # T010
Task: "Define AlertThresholdConfig in src/types/config.ts"    # T011
Task: "Define Effect union in src/types/effects.ts"           # T012

# Then port interfaces at once:
Task: "Define AuditRepository in src/ports/audit-repository.ts"  # T013
Task: "Define AlertRepository in src/ports/alert-repository.ts"  # T014
Task: "Define Notifier in src/ports/notifier.ts"                 # T015
```

## Parallel Execution Example: User Stories after Phase 2

```bash
# All three stories in parallel (all depend only on Phase 2):
Task: "Implement evaluateDetection() + tests (US1)"     # T020–T026
Task: "Implement evaluateAcknowledgment() + tests (US3)" # T027–T028
Task: "Implement evaluateEscalation() + tests (US2)"    # T029–T030
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational types + fakes (CRITICAL — blocks all stories)
3. Complete Phase 3: US1 (detection, config validation, fail-safe, effect runner, notifier stub)
4. **STOP and VALIDATE**: `vitest run tests/unit/` passes; `tsc --noEmit` passes
5. Demo: pure detection function produces correct Effect[] for a given dose + time input

### Incremental Delivery

1. Setup + Foundational → type-safe scaffold ready
2. US1 → detection + fail-safe working → deployable MVP
3. US3 → authenticated acknowledgment working → full alert lifecycle
4. US2 → escalation working → complete feature
5. Polish → adapters + integration tests + traceability matrix → release-ready

### Parallel Team Strategy (3 developers after Phase 2)

- Developer A: US1 (T019–T026) — detection + dispatcher + notifier
- Developer B: US3 (T027–T028) — acknowledgment
- Developer C: US2 (T029–T030) — escalation
- Merge order: US1 first (MVP), then US3, then US2

---

## Notes

- `[P]` tasks operate on different files — no merge conflicts
- Every engine function in `src/engine/` MUST have `@satisfies REQ-NNN` annotation(s) or `pnpm check:traceability` will fail
- `Date.now()` and `new Date()` are banned by ESLint inside `src/engine/` and `src/shell/` — always pass `now: Date` as parameter
- Test fakes in `tests/fakes/` implement the same TypeScript interfaces as production adapters — compiler verifies correctness
- Audit log is append-only at the PostgreSQL grant level (T006) — not just an application convention
- Commit after each task or logical group; commit message must reference the REQ-NNN satisfied
