# Developer Quickstart: Overdue Dose Alert with Escalation

**Branch**: `001-overdue-dose-alert`
**Prerequisites**: Node.js 20 LTS, pnpm, PostgreSQL 15+

---

## 1. Install dependencies

```bash
pnpm install
```

## 2. Configure environment

```bash
cp .env.example .env
# Set DATABASE_URL, ALERT_THRESHOLD_MINUTES (default 15),
# ESCALATION_THRESHOLD_MINUTES (default 10)
```

## 3. Initialize the database

```bash
pnpm db:migrate
# Creates: dose_events, alert_snapshots, audit_log tables
# Applies: INSERT/SELECT-only grant on audit_log for the application role
```

## 4. Run unit tests (no database required)

```bash
pnpm test:unit
# Runs all describe('REQ-NNN …') blocks using in-memory fakes
# Expected: all pass, ≥90% statement coverage
```

## 5. Run integration tests (PostgreSQL required)

```bash
pnpm test:integration
# Tests postgres-audit-repository and postgres-alert-repository adapters
# Verifies append-only constraint is enforced at DB level
```

## 6. Run all quality gates

```bash
pnpm check
# Runs in order: tsc --noEmit, eslint, vitest, coverage, check:traceability,
# check:audit-integrity, pnpm audit --audit-level=high
```

## 7. Verify traceability

```bash
pnpm check:traceability
# Confirms every exported function in src/ has @satisfies REQ-NNN annotation
# Fails CI if any function is missing its annotation
```

---

## Key architecture notes

- **Pure engine functions** in `src/engine/` take inputs + `now: Date` and return
  `Effect[]`. They never call I/O directly.
- **The shell** in `src/shell/effect-runner.ts` interprets `Effect[]` and calls
  the injected adapters. This is the only place I/O is executed.
- **Test fakes** in `tests/fakes/` implement the same port interfaces as production
  adapters. Use them in unit tests — never import adapter classes directly.
- **`Date.now()` and `new Date()`** are banned in `src/` by ESLint. Pass `now: Date`
  as a parameter everywhere time is needed.
- **The audit log** is append-only at the database level. The application role has
  no UPDATE or DELETE grant on `audit_log`.
