# MDAM — Medication Dose Alert Monitor

> Companion repository to the INCOSE 2026 Healthcare Systems Engineering Conference talk:
> **"Systems Engineering Agentic Cookbook"**
> April 30, 2026 · 10:00–11:00 AM CT · Junior Ballroom
> Justin Grammens — Lab651 & Recursive Awesome

The slides are in `slides/INCOSE_SpecFirst_AI_Engineering_FINAL.pdf`.

---

## The Talk

*AI-assisted development has accelerated how software is built, but many teams are finding that speed without structure leads to fragile systems, unclear intent, and loss of architectural discipline. Ad hoc "vibe coding" may work for isolated tasks, but it breaks down when applied to systems that require traceability, verification, and long-term evolution.*

The talk presents a practical, systems-first approach built on three ingredients:

| | Ingredient | What It Provides |
|---|---|---|
| 01 | **Systems-First Lifecycle Thinking** | Connect every decision to the full system lifecycle — from requirement to design to verification to post-deployment evolution |
| 02 | **Spec-Driven Development** | Structure before syntax. The specification is the primary engineering artifact. Code is its deterministic expression. |
| 03 | **AI-Assisted Execution** | AI operates within defined constraints — not instead of them. The spec is the AI's instruction manual and its safety boundary. |

> *In regulated industries, speed without structure is not a feature. It is a liability.*

---

## The Demo System: MDAM

MDAM is the live demo system from the talk. During the session, the audience watches it
built in real time — spec to working tests — using four SpecKit commands and Claude Code.

The scenario from slide 3:

> *2:47 AM. Room 412. Insulin overdue.*
> *The alert system shows no overdue alerts. The code looks clean. Tests pass.*
> *The root cause wasn't the developer. It wasn't the timezone. It was the absence of structure.*
> *No requirement captured the constraint. No test verified it. No trace connected hazard to code.*

MDAM makes that failure mode structurally impossible.

**Regulatory context:** IEC 62304 Class B · ISO 14971 · 21 CFR Part 11

---

## What MDAM Does

Monitors scheduled medication doses. Detects any dose unacknowledged past a configurable
threshold and escalates through a care team alert pipeline:

```
INACTIVE → ALERT_ACTIVE → ALERT_ESCALATED → ACKNOWLEDGED
           +15 min        +10 min
           Alert →        Alert →            Staff
           Care team      Charge nurse       acknowledges
```

- Detects unacknowledged doses past a configurable threshold (default 15 min)
- Alerts the care team with patient ID, medication name, and elapsed time
- Escalates to charge nurse if still unacknowledged after a second window (default 10 min)
- Requires authenticated acknowledgment to close any active alert
- Never generates duplicate alerts for the same dose event
- Records every state transition in an append-only audit log with UTC timestamp and actor ID

> *This audit log is immutable. It IS your verification evidence under IEC 62304 and 21 CFR Part 11.*

---

## Why This System for the Demo

MDAM was chosen specifically because it hits every systems engineering pressure point in a small surface area:

- Timing constraints with regulatory implications
- State transitions that must be explicit and exhaustive
- Safety-critical behavior where silent failure is the worst failure mode
- Human-in-the-loop (authenticated acknowledgment required)
- Compliance-relevant audit that maps directly to post-market surveillance obligations

---

## Architecture

### Core principles (from the project constitution)

1. **Determinism** — pure functions only; time is always injected, never read from the system clock
2. **Traceability** — every exported function annotated `@satisfies REQ-NNN`
3. **Immutable audit** — audit entries written before state transitions commit; no UPDATE or DELETE
4. **Fail-safe** — on any internal error, surface a `SYSTEM_ALERT` effect; never suppress silently
5. **TypeScript strict** — no `any` types; discriminated unions make illegal states unrepresentable

### State machine as pure functions returning effects

Business logic lives in pure functions that return `Effect[]` descriptors.
The runtime shell executes the effects — no I/O inside the engine.

```
evaluateDetection(dose, alert, config, now, eventId) → Effect[]
evaluateEscalation(dose, alert, config, now, eventId) → Effect[]   [pending]
evaluateAcknowledgment(dose, alert, actorId, eventId) → Effect[]   [pending]
```

Effect types: `WRITE_AUDIT` · `PERSIST_ALERT_RECORD` · `EMIT_ALERT_ACTIVE` ·
`EMIT_ALERT_ESCALATED` · `EMIT_SYSTEM_ALERT`

### The core contrast (from the talk)

| Vibe Coding Prompt | Spec-Driven Prompt |
|---|---|
| "Build me a medication alert system that notifies nurses when doses are late" | "Implement DoseStateEngine satisfying REQ-001 through REQ-012. Pure function. Injected timestamps. JSDoc tracing each method to requirement ID." |
| setTimeout-based timing, no UTC, no injection | Pure function — no hidden state |
| Hardcoded notification, no role map | Injected timestamps (deterministic, testable) |
| Flag variable instead of state machine | Explicit state machine — all transitions typed |
| No audit log, no actor tracking | Immutable audit entry on every transition |

*Same AI. Completely different engineering. The spec is what made the difference.*

### Key design decisions

| Decision | Reason |
|---|---|
| `AlertRecord` as discriminated union (4 variants) | Invalid states unrepresentable at compile time |
| `now: Date` injected on every function | `Date.now()` banned in business logic (REQ-010) |
| Millisecond integer comparisons | Exact precision at boundaries (14:59.999 vs 15:00.000) |
| `AuditRepository` exposes only `append()` + `findByDoseId()` | Structural append-only enforcement |
| `crypto.randomUUID()` in adapter layer only | UUID generation is non-deterministic; stays outside pure functions |
| Effect order: `WRITE_AUDIT → PERSIST_ALERT_RECORD → EMIT_*` | Audit written before transition committed (REQ-006) |

---

## SpecKit Maps to the V-Model

From the talk — the same artifacts that IEC 62304 requires, now generated in minutes instead of weeks:

| V-Model Phase | SpecKit Command | Output |
|---|---|---|
| System Requirements | `/speckit-constitution` | Non-negotiable principles · Regulatory standards · Safety constraints |
| Software Requirements | `/speckit-specify` | REQ-NNN requirements · Acceptance scenarios · Boundary conditions |
| Architectural Design | `/speckit-plan` | Constitution check · Traceability map · Data model · ADRs |
| Detailed Design | `/speckit-tasks` | 35 tasks · File paths · REQ-NNN per task · Parallel markers |
| Code Review | `@satisfies` annotations | Every export annotated · CI traceability check enforced |
| Software Unit Verification | Test suite by REQ | 60 tests · 7 describe blocks labeled REQ-NNN · injected time |
| Software Integration Test | Traceability matrix | `specs/requirements.md` · REQ → function → test → status |
| System Validation | Quality gate pipeline | `npm run check` · tsc · coverage ≥90% · traceability CI |

---

## Project Structure

```
slides/
  INCOSE_SpecFirst_AI_Engineering_FINAL.pdf  — conference talk slides

src/
  types/
    domain.ts           — branded primitives: DoseId, PatientId, ActorId, EventId, AlertStatus
    dose-event.ts       — immutable DoseEvent interface
    alert-record.ts     — AlertRecord discriminated union (INACTIVE, ALERT_ACTIVE, ALERT_ESCALATED, ACKNOWLEDGED)
    audit-entry.ts      — append-only AuditEntry with ISO 8601 UTC timestamp
    config.ts           — AlertThresholdConfig (positive integer minutes, validated at startup)
    effects.ts          — Effect union (5-variant side-effect algebra)
  engine/
    detect.ts           — evaluateDetection() pure function (REQ-001, REQ-002, REQ-003, REQ-010)
    config-validator.ts — validateConfig() + ConfigValidationError (REQ-011, REQ-012)

tests/
  unit/
    engine/
      detect.test.ts            — 26 tests across 4 REQ-labeled describe blocks
      config-validator.test.ts  — 34 tests across 3 REQ-labeled describe blocks

specs/
  001-overdue-dose-alert/
    spec.md             — 3 user stories · 12 requirements · 4 entities · 7 success criteria
    plan.md             — architecture decisions · constitution check · 6-phase breakdown
    data-model.md       — TypeScript types · PostgreSQL schema · port interfaces
    research.md         — 8 architectural decisions (D-001 through D-008) with rationale
    tasks.md            — 35 tasks · 6 phases · parallelization markers · 100% REQ coverage
    contracts/
      alert-service.ts  — typed port interfaces (AuditRepository, AlertRepository, Notifier)
  requirements.md       — living traceability matrix (IEC 62304 §5.5.5)

.specify/
  memory/
    constitution.md     — 7 NON-NEGOTIABLE engineering principles (project governance)
```

---

## Requirements

| ID | Description | Status |
|---|---|---|
| REQ-001 | Detect dose overdue past threshold | ✅ Complete |
| REQ-002 | Emit care team alert with patient/medication/time | ✅ Complete |
| REQ-003 | No duplicate alerts for same dose event | ✅ Complete |
| REQ-004 | Escalate to charge nurse after escalation window | ⏳ Pending |
| REQ-005 | Escalation alert includes elapsed time | ⏳ Pending |
| REQ-006 | Write audit entry before each state transition | ⚠️ Partial |
| REQ-007 | Require authenticated acknowledgment to close alert | ⏳ Pending |
| REQ-008 | Reject and log anonymous acknowledgment attempts | ⏳ Pending |
| REQ-009 | Surface SYSTEM_ALERT on internal error; never suppress | ⏳ Pending |
| REQ-010 | Identical inputs must produce identical outputs (determinism) | ⚠️ Partial |
| REQ-011 | Validate alertThresholdMinutes at startup | ✅ Complete |
| REQ-012 | Validate escalationThresholdMinutes at startup | ✅ Complete |

See `specs/requirements.md` for the full traceability matrix linking each requirement
to its implementing function, test file, and describe block.

---

## Getting Started

### Prerequisites

- Node.js 20 LTS or later
- npm or pnpm

### Install

```bash
npm install
```

### Run tests

```bash
npm test
```

### Run with coverage

```bash
npm run coverage
```

Coverage threshold: 90% statement coverage (enforced by vitest).

### Type-check and lint

```bash
npm run typecheck
npm run lint
```

### Run all quality gates

```bash
npm run check
```

Runs typecheck → lint → test → coverage sequentially.

---

## Test Structure

Tests are organized by requirement — one `describe` block per REQ-NNN:

```
detect.test.ts
  describe('REQ-001: detect dose overdue past threshold')      — 6 tests
  describe('REQ-002: emit care team alert')                     — 11 tests
  describe('REQ-003: no duplicate alerts')                      — 3 tests
  describe('REQ-010: determinism')                              — 6 tests

config-validator.test.ts
  describe('REQ-011: alertThresholdMinutes validation')         — 14 tests
  describe('REQ-012: escalationThresholdMinutes validation')    — 14 tests
  describe('structural validation')                             — 6 tests
```

Key test patterns:
- Boundary: `T+15:00.000` → `ALERT_ACTIVE` fires; `T+14:59.999` → silent
- All time values are UTC `Date` literals — `Date.now()` appears nowhere in tests
- Frozen fixtures (`Object.freeze`) enforce immutability assumptions
- Effect ordering verified: `WRITE_AUDIT` always precedes `PERSIST_ALERT_RECORD`

---

## Implementation Status

**Phase 1–2 complete (T001–T022):**
- All domain types
- `evaluateDetection()` pure function
- `validateConfig()` with startup validation
- 60 unit tests, all passing

**Phases 3–6 pending (T023–T035):**
- `evaluateEscalation()` — escalation to charge nurse (REQ-004, REQ-005)
- `evaluateAcknowledgment()` — authenticated acknowledgment (REQ-007, REQ-008)
- Fail-safe error boundary (REQ-009)
- PostgreSQL adapters (AuditRepository, AlertRepository)
- Production Notifier adapter
- Integration tests
- Full traceability matrix pass

---

## How to Reproduce From Scratch

This is what was run live during the talk — four commands before any implementation:

### Prerequisites

```bash
# Install SpecKit CLI
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git

# Install Claude Code
npm install -g @anthropic-ai/claude-code

# Initialize SpecKit in your project directory
specify init   # choose Claude when prompted

# Open Claude Code
claude
```

### The four SpecKit commands

```
/speckit-constitution  — 7 NON-NEGOTIABLE engineering principles
/speckit-specify       — spec.md: 3 user stories · 12 requirements · 4 entities
/speckit-plan          — plan.md + data-model.md + research.md + contracts/
/speckit-tasks         — tasks.md: 35 tasks · 6 phases · 100% REQ coverage
```

### Implementation by task ID

```
Implement T020 from specs/001-overdue-dose-alert/tasks.md
Implement T021 and T022 from specs/001-overdue-dose-alert/tasks.md
Implement T034 from specs/001-overdue-dose-alert/tasks.md
```

### The spec prompt format

```
[Feature name]

OBJECTIVE    — the failure mode, not the feature description
BEHAVIOR     — observable outcomes only, no tech details
CONSTRAINTS  — non-negotiables regardless of implementation
VERIFICATION — testable criteria, not subjective ones
```

---

## Three Truths (from the closing slide)

> *AI doesn't make bad engineering good. It makes it faster.*

> *A spec is not bureaucracy. It's the difference between building fast and building right fast.*

> *Traceability isn't a compliance artifact. It's how you prove — to yourself, your team, and a regulator — that you knew what you were doing.*

---

Justin Grammens · [lab651.com](https://lab651.com) · [recursiveawesome.com](https://recursiveawesome.com) · [appliedai.mn](https://appliedai.mn)

*Lab651 — we responsibly leverage AI without compromising human oversight.*
