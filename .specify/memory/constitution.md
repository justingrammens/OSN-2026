<!--
Sync Impact Report
Version change: (blank template) → 1.0.0
Modified principles: All placeholders replaced with concrete governance text
Added sections:
  - Regulatory Context (new — replaces generic SECTION_2)
  - Quality Gates (new — replaces generic SECTION_3)
Removed sections: None
Templates requiring updates:
  ✅ .specify/templates/plan-template.md — Constitution Check gate list aligns with 7 principles
  ✅ .specify/templates/spec-template.md — Requirements use REQ-NNN format per Principle III
  ✅ .specify/templates/tasks-template.md — Audit/traceability and fail-safe task categories acknowledged
  ✅ .specify/templates/commands/ — No commands directory found; no updates required
Follow-up TODOs:
  - None; all fields resolved from user input and repo context
-->

# Medication Alert Monitor (MDAM) Constitution

## Core Principles

### I. Regulatory Compliance (NON-NEGOTIABLE)

All code, processes, and artifacts MUST conform to the following standards:

- **IEC 62304 Class B** — Software development lifecycle documentation, architecture,
  unit/integration testing, problem resolution, and configuration management MUST
  satisfy Class B requirements. No Class C upgrade path is assumed; any feature that
  raises risk classification MUST trigger an amendment review.
- **ISO 14971** — A risk management file MUST exist and be updated before each release.
  Every requirement in the system MUST trace to at least one hazard analysis entry or
  explicitly justify its absence.
- **21 CFR Part 11** — All electronic records (audit logs, state transitions, test
  results) MUST be attributable to a specific actor ID, timestamped in UTC, and stored
  in an append-only medium. Access controls and audit trails are not optional.

Rationale: MDAM operates in a regulated healthcare environment. Non-compliance exposes
patients to undetected medication errors and exposes the organization to regulatory
action. These standards are constraints, not aspirations.

### II. Determinism (NON-NEGOTIABLE)

All business-logic functions MUST be pure:

- Given identical inputs they MUST produce identical outputs with no observable side
  effects.
- Time MUST be injected as an explicit parameter (e.g., `now: Date`). Calls to
  `Date.now()`, `new Date()`, or any ambient clock inside business logic are
  **forbidden**.
- External I/O (database reads, network calls) MUST be isolated behind injected
  interfaces and MUST NOT appear inside functions that carry a `@satisfies` annotation.

Rationale: Non-deterministic functions are untestable under controlled conditions,
violate IEC 62304 test reproducibility requirements, and make root-cause analysis
after incidents impossible.

### III. Traceability (NON-NEGOTIABLE)

Every exported function, class, and type that implements a system requirement MUST
carry a JSDoc `@satisfies REQ-NNN` annotation referencing the canonical requirement
identifier:

```typescript
/**
 * @satisfies REQ-042
 */
export function evaluateAlertThreshold(dose: Dose, now: Date): AlertDecision { … }
```

- Requirement identifiers follow the format `REQ-NNN` (three-digit zero-padded integer).
- A requirement registry MUST be maintained at `specs/requirements.md`.
- No function may reference a REQ-NNN that does not exist in the registry.
- Orphaned annotations (REQ-NNN with no implementing function) MUST be flagged in CI.

Rationale: IEC 62304 §5.5.5 requires software unit verification to trace to
requirements. Inline annotations make traceability machine-checkable and survive
refactors better than external matrices.

### IV. Immutable Audit Log (NON-NEGOTIABLE)

Every system state transition MUST be recorded as an append-only audit event
containing at minimum:

| Field        | Type   | Constraint                        |
|--------------|--------|-----------------------------------|
| `eventId`    | string | UUID v4, unique across all time   |
| `timestamp`  | string | ISO 8601 UTC (`Z` suffix required)|
| `actorId`    | string | Non-empty; system or user identity|
| `transition` | string | `FROM_STATE → TO_STATE` canonical |
| `payload`    | object | Serializable; no circular refs    |

- Audit records MUST be written before the transition is considered committed.
- Audit storage MUST be append-only; no update or delete operations are permitted on
  committed records.
- Audit queries are read-only projections; they MUST NOT modify the audit store.

Rationale: 21 CFR Part 11 mandates attributable, legible, contemporaneous, and
accurate electronic records. An immutable log is the only data structure that
satisfies all four adjectives simultaneously.

### V. Fail-Safe Error Handling (NON-NEGOTIABLE)

On any unhandled exception, unexpected discriminated-union variant, or degraded
external dependency, the system MUST:

1. Log the error to the audit log with `actorId: "system"` and full stack context.
2. Surface a `SYSTEM_ALERT` to the operator immediately.
3. Transition to a defined safe state (see risk management file for state definitions).

Suppressing, swallowing, or silently ignoring errors is **forbidden**. `catch` blocks
that do not re-throw, log, or escalate require explicit written justification in the
risk management file.

Rationale: ISO 14971 residual risk controls depend on alerts reaching operators.
Silent failures are indistinguishable from normal operation and represent the highest
patient-safety risk class in this system.

### VI. Test Discipline (NON-NEGOTIABLE)

- Each requirement `REQ-NNN` MUST have exactly one `describe('REQ-NNN …')` block in
  the test suite. Multiple `it`/`test` cases within that block are expected and
  encouraged.
- Every `describe` block MUST include at least one boundary-value test and one
  invalid-input (error path) test.
- Test files MUST NOT import real I/O implementations; all external dependencies MUST
  be injected doubles (fakes or stubs — not auto-mocking libraries that bypass types).
- Tests MUST be deterministic: no `Date.now()`, no `Math.random()`, no sleep/retry
  loops without injected clocks.
- Code coverage gate: ≥90% statement coverage on all files under `src/`.

Rationale: IEC 62304 §5.5 requires that each software unit be verified against its
requirements. A one-to-one describe/REQ mapping makes coverage gaps immediately
visible and simplifies audit evidence generation.

### VII. TypeScript Strict Mode (NON-NEGOTIABLE)

- `tsconfig.json` MUST include `"strict": true` with no per-file `// @ts-ignore` or
  `// @ts-expect-error` suppressions unless the suppressed line references a known
  upstream type-definition defect (MUST be documented in a comment with issue URL).
- `any` types are **forbidden** in source files and test files. `unknown` with
  explicit narrowing is the correct substitute.
- All system states MUST be modelled as discriminated unions with an exhaustive
  `switch` or `match` expression:
  ```typescript
  type AlertState =
    | { kind: 'INACTIVE' }
    | { kind: 'PENDING'; since: Date }
    | { kind: 'ACTIVE'; triggeredAt: Date; actorId: string }
    | { kind: 'ACKNOWLEDGED'; acknowledgedAt: Date; actorId: string };
  ```
- The `never` type MUST be used in exhaustiveness checks so the compiler enforces
  total coverage of all union variants.

Rationale: Strict typing eliminates an entire class of runtime errors in
safety-critical paths. Discriminated unions make illegal states unrepresentable,
reducing the risk of undetected state-machine violations at compile time.

## Regulatory Context

This project is classified as **IEC 62304 Class B** medical device software. The
following regulatory artifacts MUST be maintained and kept current:

| Artifact                     | Location                          | Owner           |
|------------------------------|-----------------------------------|-----------------|
| Software Requirements Spec   | `specs/requirements.md`           | Lead Engineer   |
| Risk Management File         | `specs/risk-management.md`        | Safety Officer  |
| Software Architecture Doc    | `specs/architecture.md`           | Lead Engineer   |
| Verification & Validation    | `specs/verification.md`           | QA Lead         |
| Problem Resolution Records   | `specs/problem-resolution/`       | Any contributor |
| Audit Log Storage Config     | `config/audit-store.ts`           | Lead Engineer   |

**Change Control**: Any change to source code, configuration, or regulatory artifacts
MUST be traceable to a requirement identifier (`REQ-NNN`) or a problem resolution
record (`PR-NNN`). Direct pushes to `main` without traceability metadata are
prohibited.

**Release Gate**: A release MUST NOT be cut unless:
- All `REQ-NNN` test suites pass.
- The risk management file has been reviewed for the release scope.
- Audit log append-only integrity has been verified by the automated integrity check.
- No open `CRITICAL` or `HIGH` severity problem resolution records exist.

## Quality Gates

The following automated checks MUST pass on every pull request. Failures block merge;
they MUST NOT be bypassed.

| Gate                          | Tool / Command              | Pass Criterion                      |
|-------------------------------|-----------------------------|-------------------------------------|
| TypeScript strict compile     | `tsc --noEmit`              | Zero errors                         |
| Lint                          | `eslint src/ tests/`        | Zero errors (warnings allowed ≤5)  |
| Unit tests                    | `vitest run`                | All pass                            |
| Coverage                      | `vitest run --coverage`     | ≥90% statement coverage             |
| Traceability check            | `pnpm check:traceability`   | No orphaned REQ-NNN annotations     |
| Audit log integrity           | `pnpm check:audit-integrity`| Append-only invariant holds         |
| Dependency vulnerability scan | `pnpm audit --audit-level=high` | Zero HIGH/CRITICAL findings    |

**No exceptions** to quality gates are permitted without a documented deviation record
in the risk management file and sign-off from the Safety Officer.

## Governance

- This constitution supersedes all other development practices, team conventions, and
  prior guidance documents. In case of conflict, this document wins.
- **Amendment procedure**: Amendments MUST be proposed via pull request with a filled
  Sync Impact Report (see top of this file for format). Amendments to
  NON-NEGOTIABLE principles require Safety Officer sign-off. All other amendments
  require Lead Engineer sign-off.
- **Versioning policy**: MAJOR bump for removal or redefinition of a NON-NEGOTIABLE
  principle; MINOR bump for new principle or material expansion; PATCH for
  clarifications and wording fixes.
- **Compliance review**: Constitution compliance MUST be reviewed at each sprint
  retrospective and MUST be part of the release checklist.
- **Runtime guidance**: Consult `.specify/memory/` for agent-facing elaborations of
  these principles. Guidance files extend but MUST NOT contradict this constitution.

**Version**: 1.0.0 | **Ratified**: 2026-04-20 | **Last Amended**: 2026-04-20