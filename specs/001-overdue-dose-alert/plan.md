# Implementation Plan: Overdue Dose Alert with Escalation

**Branch**: `001-overdue-dose-alert` | **Date**: 2026-04-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-overdue-dose-alert/spec.md`

## Summary

Implement a safety-critical medication alert monitor that detects unacknowledged
scheduled doses past a configurable threshold (default 15 min), alerts the care
team, escalates to the charge nurse after a second configurable window (default
10 min), and requires authenticated acknowledgment to close any alert. Every state
transition is recorded to an append-only audit log. The system is implemented as
a set of pure TypeScript functions with injected time and swappable I/O adapters,
targeting Node.js 20 LTS with Vitest and PostgreSQL.

## Technical Context

**Language/Version**: TypeScript 5.x, `"strict": true`, Node.js 20 LTS
**Primary Dependencies**: `uuid` (EventId generation), `pg` or `postgres` (PostgreSQL adapter), ESLint + `@typescript-eslint`
**Storage**: PostgreSQL 15+ — `audit_log` (INSERT/SELECT only), `alert_snapshots`, `dose_events`
**Testing**: Vitest + `@vitest/coverage-v8`; ≥90% statement coverage enforced via `vitest.config.ts`
**Target Platform**: Node.js 20 LTS service (Linux server)
**Project Type**: Library + service (pure-function core published as internal library; application shell wires adapters)
**Performance Goals**: Alert detection latency < 1 evaluation cycle (scheduler-controlled); audit writes durable before response
**Constraints**: All time injected — `Date.now()` / `new Date()` banned in `src/` via ESLint; no `any` types; append-only audit at DB level
**Scale/Scope**: Per-facility deployment; hundreds of concurrent dose events per shift; audit log partitioned monthly

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status |
|-----------|------|--------|
| I. Regulatory Compliance | IEC 62304 Class B artifacts planned (research.md, data-model.md, contracts, risk management stubs) | ✅ PASS |
| II. Determinism | Pure functions confirmed; `Date.now()` / `new Date()` ESLint ban planned (D-002 research) | ✅ PASS |
| III. Traceability | `@satisfies REQ-NNN` annotations planned on all exported functions; `check:traceability` CI job specified | ✅ PASS |
| IV. Immutable Audit | PostgreSQL `audit_log` INSERT/SELECT only; DB-level grant enforced; no UPDATE/DELETE (D-003 research) | ✅ PASS |
| V. Fail-Safe | Effect descriptor `EMIT_SYSTEM_ALERT` emitted on every unhandled error; no silent catches | ✅ PASS |
| VI. Test Discipline | One `describe('REQ-NNN …')` block per requirement; in-memory fakes (no auto-mocks); coverage gate in config | ✅ PASS |
| VII. TypeScript Strict Mode | `"strict": true`; no `any`; discriminated union `AlertRecord`; `never` exhaustiveness on all switches | ✅ PASS |

**Post-Phase 1 re-check**: All gates remain PASS. Data model uses discriminated unions throughout. Adapter interfaces are fully typed. No violations requiring Complexity Tracking justification.

## Project Structure

### Documentation (this feature)

```text
specs/001-overdue-dose-alert/
├── plan.md              # This file
├── research.md          # Phase 0 — 8 decisions documented
├── data-model.md        # Phase 1 — TypeScript types + PostgreSQL schema
├── quickstart.md        # Phase 1 — developer setup guide
├── contracts/
│   └── alert-service.ts # TypeScript interface contracts (ports)
└── tasks.md             # Phase 2 — created by /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── types/
│   ├── domain.ts          # DoseId, PatientId, ActorId, EventId branded types
│   ├── alert-record.ts    # AlertRecord discriminated union
│   ├── audit-entry.ts     # AuditEntry interface
│   ├── config.ts          # AlertThresholdConfig
│   └── effects.ts         # Effect union (side-effect algebra)
├── ports/
│   ├── audit-repository.ts   # AuditRepository interface
│   ├── alert-repository.ts   # AlertRepository interface
│   └── notifier.ts           # Notifier interface
├── engine/
│   ├── detect.ts          # @satisfies REQ-001, REQ-002, REQ-003, REQ-010
│   ├── escalate.ts        # @satisfies REQ-004, REQ-005, REQ-010
│   ├── acknowledge.ts     # @satisfies REQ-007, REQ-008
│   └── config-validator.ts # @satisfies REQ-011, REQ-012
├── shell/
│   ├── effect-runner.ts   # Interprets Effect[] — wires adapters to pure engine
│   └── error-boundary.ts  # @satisfies REQ-009 — wraps shell in fail-safe handler
└── adapters/
    ├── postgres-audit-repository.ts
    ├── postgres-alert-repository.ts
    └── http-notifier.ts

tests/
├── unit/
│   ├── engine/
│   │   ├── detect.test.ts        # describe('REQ-001 …'), describe('REQ-002 …'), etc.
│   │   ├── escalate.test.ts
│   │   ├── acknowledge.test.ts
│   │   └── config-validator.test.ts
│   └── shell/
│       └── error-boundary.test.ts
├── fakes/
│   ├── in-memory-audit-repository.ts
│   ├── in-memory-alert-repository.ts
│   └── recording-notifier.ts    # Captures dispatched events for assertion
└── integration/
    ├── postgres-audit-repository.test.ts
    └── postgres-alert-repository.test.ts
```

**Structure Decision**: Single project layout. Pure engine in `src/engine/` is the
domain core. Ports in `src/ports/` define the adapter contracts. Adapters in
`src/adapters/` contain the only real I/O. The shell in `src/shell/` wires engine
output (Effect[]) to adapters. This mirrors hexagonal architecture without
introducing framework overhead.

## Phase 0: Research Summary

All technical decisions resolved. See `research.md` for full rationale.

| Decision | Outcome |
|----------|---------|
| D-001 | Pure function state machine with Effect descriptor return values |
| D-002 | Injected `now: Date`; ESLint ban on ambient clock in `src/` |
| D-003 | PostgreSQL append-only `audit_log`; INSERT/SELECT grant only at DB level |
| D-004 | Typed `AuditRepository` + `Notifier` interfaces; in-memory fakes for tests |
| D-005 | UUID v4 via `crypto.randomUUID()` (Node 20 native); generated in adapter |
| D-006 | Vitest + `@vitest/coverage-v8`; 90% coverage threshold in `vitest.config.ts` |
| D-007 | `@typescript-eslint/recommended-type-checked` + custom safety rules |
| D-008 | `check:traceability` CI job verifies `@satisfies REQ-NNN` on all exports |

No NEEDS CLARIFICATION items remain.

## Phase 1: Design Summary

### Data Model

See `data-model.md` for the full TypeScript type definitions and PostgreSQL schema.

Key design decisions:
- `AlertRecord` is a discriminated union with `kind` discriminant. Each variant
  carries only the fields valid for that state — illegal states are unrepresentable.
- `Effect` union decouples the pure state engine from I/O. The shell reads the
  returned `Effect[]` and executes them in order, handling partial failures.
- `AuditEntry.timestamp` is always a UTC ISO 8601 string with `Z` suffix — never
  a bare `Date` object, preventing accidental timezone coercion.
- The `audit_log` table has no UPDATE or DELETE grants on the application role,
  enforcing Constitution Principle IV at the database layer.

### Interface Contracts

See `contracts/alert-service.ts` for the TypeScript port interfaces:
- `AuditRepository` — `append()` + `findByDoseId()`
- `AlertRepository` — `findByDoseId()` + `save()`
- `Notifier` — `dispatchAlertActive()` + `dispatchAlertEscalated()` + `dispatchSystemAlert()`

All three interfaces are the seams at which test fakes plug in. No business logic
crosses these interfaces.

### Traceability Map (REQ → Function)

| Requirement | Implementing Function(s)            | Test File                        |
|-------------|-------------------------------------|----------------------------------|
| REQ-001     | `engine/detect.ts:evaluateDetection`| `tests/unit/engine/detect.test.ts` |
| REQ-002     | `engine/detect.ts:evaluateDetection`| `tests/unit/engine/detect.test.ts` |
| REQ-003     | `engine/detect.ts:evaluateDetection`| `tests/unit/engine/detect.test.ts` |
| REQ-004     | `engine/escalate.ts:evaluateEscalation` | `tests/unit/engine/escalate.test.ts` |
| REQ-005     | `engine/escalate.ts:evaluateEscalation` | `tests/unit/engine/escalate.test.ts` |
| REQ-006     | `engine/detect.ts`, `escalate.ts`, `acknowledge.ts` | all engine tests |
| REQ-007     | `engine/acknowledge.ts:evaluateAcknowledgment` | `tests/unit/engine/acknowledge.test.ts` |
| REQ-008     | `engine/acknowledge.ts:evaluateAcknowledgment` | `tests/unit/engine/acknowledge.test.ts` |
| REQ-009     | `shell/error-boundary.ts:withFailSafe` | `tests/unit/shell/error-boundary.test.ts` |
| REQ-010     | All `engine/` functions (pure by design) | all engine tests (determinism assertions) |
| REQ-011     | `engine/config-validator.ts:validateConfig` | `tests/unit/engine/config-validator.test.ts` |
| REQ-012     | `engine/config-validator.ts:validateConfig` | `tests/unit/engine/config-validator.test.ts` |
