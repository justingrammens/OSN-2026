# Research: Overdue Dose Alert with Escalation

**Branch**: `001-overdue-dose-alert`
**Date**: 2026-04-20
**Phase**: 0 — Research & Decision Log

---

## D-001: Pure Function State Machine in TypeScript

**Decision**: Implement the alert lifecycle as a set of pure transition functions
that take the current `AlertRecord` and a stimulus (detect, escalate, acknowledge)
and return a new `AlertRecord` plus a list of side-effect descriptors. No mutation.
No shared module-level state.

**Rationale**: Pure functions are referentially transparent — the same inputs always
produce the same outputs, satisfying REQ-010 and Constitution Principle II. They
require no test setup beyond constructing input values, and they compose without
surprise. The side-effect descriptor pattern (returning a list of `Effect` values
rather than executing effects) keeps business logic fully decoupled from I/O.

**Alternatives considered**:
- Class-based state machine with `transition()` method — rejected because class
  instances carry mutable state, violating the determinism principle.
- XState/Zod-validated finite state machine library — rejected as over-engineering
  for 4 states; the library would add a dependency and obscure the traceability
  annotations the constitution requires.

---

## D-002: Injected Time Pattern

**Decision**: Every function that computes durations or evaluates thresholds MUST
accept `now: Date` as an explicit parameter. `Date.now()` and `new Date()` are
banned from `src/` via ESLint rule (`no-restricted-syntax` targeting those patterns).

**Rationale**: Injected time is the only way to write deterministic tests for
time-sensitive logic (e.g., "exactly 15:00 versus 14:59"). Constitution Principle II
forbids ambient clock access. An ESLint rule makes the ban machine-enforceable.

**Alternatives considered**:
- Sinon/Jest fake timers — rejected because they patch the global clock, which is
  fragile under parallel test execution and doesn't survive across module boundaries.
- A `ClockService` class — rejected as unnecessary indirection; a plain `Date`
  parameter is simpler and expresses intent clearly.

---

## D-003: PostgreSQL Append-Only Audit Table

**Decision**: The audit log is stored in a single PostgreSQL table `audit_log` with
no UPDATE or DELETE grants on the application role. Row-level security ensures the
application user can only INSERT and SELECT. A separate `alert_snapshots` table
holds the current derived state, updated transactionally in the same write as the
audit INSERT.

**Rationale**: 21 CFR Part 11 requires an immutable, attributable audit trail.
Postgres row-level security enforced at the DB level is stronger than application-
layer conventions — it survives future code changes. The transactional
INSERT-together-with-snapshot write ensures the derived state is always consistent
with the audit log (no orphaned transitions).

**Alternatives considered**:
- Event-sourced store (e.g., EventStoreDB) — provides stronger append-only
  guarantees but adds operational complexity and a second data store to maintain.
  Deferred to future architecture evolution.
- Separate audit service over HTTP — rejected for this feature; network calls in
  the write path introduce latency and partial-failure modes that complicate
  rollback logic.
- File-based append-only log — rejected; does not support transactional reads
  needed for duplicate suppression (REQ-003, REQ-005).

---

## D-004: Repository + Adapter Pattern for Storage and Notification

**Decision**: Define two TypeScript interfaces: `AuditRepository` (append + query)
and `Notifier` (dispatch alert events). Production implementations use PostgreSQL
and the downstream notification system respectively. Test implementations are
in-memory fakes that implement the same interfaces.

**Rationale**: Constitution Principle VI forbids importing real I/O in tests.
Typed interfaces allow the compiler to verify that fakes are structurally correct,
unlike mocks generated at runtime (which can diverge silently from the real type).

**Alternatives considered**:
- `vi.mock()` auto-mocks — rejected; auto-mocks bypass type checking and can mask
  interface changes, as documented in the constitution.
- A single unified `Repository` class — rejected; separating audit persistence from
  notification keeps each adapter's responsibility narrow and independently testable.

---

## D-005: UUID v4 for Audit Event IDs

**Decision**: Use the `uuid` npm package (`uuid` v9+, `crypto.randomUUID()` under
Node 20) to generate `eventId` values. Generation happens in the infrastructure
layer (the repository adapter), not in the pure business logic.

**Rationale**: UUID v4 provides sufficient uniqueness for audit event deduplication
across distributed evaluation cycles. `crypto.randomUUID()` is available natively
in Node 20 without additional dependencies. Moving generation to the adapter keeps
the pure state-machine functions free of I/O.

**Alternatives considered**:
- ULIDs — monotonically sortable and URL-safe, but adds a dependency for marginal
  benefit in this use case. Can be adopted later without API changes.
- Database-generated UUIDs (`gen_random_uuid()`) — rejected as primary ID strategy
  because the application must know the eventId before the INSERT to include it in
  the audit payload.

---

## D-006: Vitest as Test Runner

**Decision**: Vitest with `@vitest/coverage-v8` for coverage. Test files co-located
with source under `src/**/*.test.ts`. Dedicated integration test directory at
`tests/integration/` for tests that require a real database connection.

**Rationale**: Vitest is the natural choice for a TypeScript-first ESM project. V8
coverage avoids the Istanbul instrumentation overhead and works correctly with
TypeScript source maps. The 90% statement coverage gate from the constitution is
enforced via `vitest.config.ts` `coverage.thresholds`.

**Alternatives considered**:
- Jest — mature but requires more configuration for ESM/TypeScript strict projects;
  ts-jest adds a compilation layer that can produce misleading coverage numbers.
- Mocha + c8 — valid but requires more manual wiring; Vitest's built-in TypeScript
  support reduces setup complexity.

---

## D-007: ESLint Configuration for Safety-Critical Rules

**Decision**: Extend `@typescript-eslint/recommended-type-checked` and add custom
rules:
- `no-restricted-syntax` to ban `Date.now()`, `new Date()` inside `src/` (with
  allowlist for the adapter layer).
- `@typescript-eslint/no-explicit-any` set to `error`.
- `@typescript-eslint/switch-exhaustiveness-check` set to `error` (enforces `never`
  on discriminated union switches).

**Rationale**: Machine-enforced bans are more reliable than code-review conventions.
The switch-exhaustiveness rule directly implements Constitution Principle VII's
requirement for `never`-guarded exhaustive switches.

**Alternatives considered**:
- Custom ESLint plugin — overkill for three rules; standard rule configuration
  is sufficient and easier for new contributors to understand.

---

## D-008: Traceability Enforcement via Custom ESLint Rule

**Decision**: Write a lightweight ESLint rule (or use a `grep`-based CI check) that
verifies every exported function in `src/` either has a `@satisfies REQ-NNN` JSDoc
annotation or appears in an explicit exclusion list (infrastructure adapters, index
re-exports). The CI job runs `pnpm check:traceability` and fails on any violation.

**Rationale**: Constitution Principle III requires annotations on every implementing
function. A manual process would erode over time; an automated check makes the
requirement self-enforcing.

**Alternatives considered**:
- TypeDoc-based annotation extraction — TypeDoc can parse JSDoc tags but adds
  documentation generation overhead. A focused grep/AST check is faster in CI.
- Separate requirements-traceability tool (e.g., Doorstop) — full regulatory
  traceability tooling is valuable for IEC 62304 Class B but is out of scope for
  this feature; deferred to a dedicated governance feature.
