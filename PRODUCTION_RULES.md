# IronLog — Production Rules for Claude

This file is the **source of truth** for how Claude builds, tests and ships IronLog.
Every task in [`TASKS.md`](./TASKS.md) is executed under these rules. If a task and
this file disagree, this file wins — flag the conflict instead of guessing.

---

## 1. Rules of Engagement (two-agent model)

All work is done by **exactly two agents** with separate responsibilities. Neither agent
does the other's job.

| | **Builder Agent** | **Release Agent** (tester + publisher) |
|---|---|---|
| Purpose | Implements one task from `TASKS.md` to spec | Verifies the work and ships it to GitHub |
| Writes feature code | ✅ Yes | ❌ Never |
| Writes tests | ✅ Unit + integration tests for its own code | ✅ May add missing e2e/regression tests, never edits feature code to make tests pass |
| Runs tests | ✅ Locally while building (fast feedback) | ✅ The **full** production gate (Section 6) |
| Commits | ✅ On the task's feature branch, locally | ✅ Only the `TASKS.md` status update + its own test files |
| Pushes to GitHub | ❌ **Never** | ✅ Only after every gate passes |
| Opens / merges PR | ❌ | ✅ |

### 1.1 Workflow loop

```
 ┌──────────────┐  handoff report   ┌──────────────┐   all gates pass   ┌────────────┐
 │ Builder Agent│ ────────────────▶ │ Release Agent│ ─────────────────▶ │  GitHub    │
 │ (implements) │ ◀──────────────── │ (verifies)   │   push + PR + CI   │  (main)    │
 └──────────────┘  failure report   └──────────────┘                    └────────────┘
```

1. **Builder** picks the next task whose dependencies are all `[x]` in `TASKS.md`.
2. **Builder** creates the branch, implements the task, writes tests, runs the quick checks
   (`lint`, `typecheck`, `test`) and produces a **Handoff Report** (Section 1.2).
3. **Release Agent** checks out the branch and runs the **full production gate** (Section 6)
   and the **rules compliance checklist** (Section 7).
4. Any failure → Release Agent sends a **Failure Report** back to Builder (exact command,
   exact output, which rule/criterion failed). Builder fixes. Go to step 3.
   - After **3 failed cycles on the same task**, stop and escalate to the human.
5. All green → Release Agent marks the task `[x]` in `TASKS.md`, pushes the branch,
   opens a PR containing the **Validation Report** (Section 1.3), waits for GitHub
   Actions CI to pass, then squash-merges into `main`.
6. One task at a time. A new task does not start until the previous one is merged.

### 1.2 Handoff Report (Builder → Release Agent)

```markdown
## Handoff: <TASK-ID> <title>
Branch: <branch>
Summary: <what was built, 2–5 lines>
Files changed: <list>
Acceptance criteria:
- [x] AC1 … (how it is met / where it is tested)
- [x] AC2 …
Tests added: <files + what they cover>
Local checks: lint ✅ typecheck ✅ test ✅
Known limitations / follow-ups: <or "none">
```

### 1.3 Validation Report (Release Agent → PR body)

```markdown
## Validation: <TASK-ID> <title>
| Gate | Command | Result |
|---|---|---|
| Install | npm ci | ✅ |
| Lint | npm run lint | ✅ |
| Typecheck | npm run typecheck | ✅ |
| Unit/Integration | npm test | ✅ N passed |
| Coverage | npm run test:coverage | ✅ lines X% / branches Y% |
| E2E | npm run test:e2e | ✅ N passed |
| Build | npm run build | ✅ |
| Security audit | npm audit --omit=dev --audit-level=high | ✅ |
Acceptance criteria: all N verified ✅
Rules checklist (PRODUCTION_RULES §7): all items ✅
```

---

## 2. Process of Creation (task lifecycle)

1. **Read** — the task in `TASKS.md`, this file, and the code it touches. Never edit code you
   have not read.
2. **Plan** — list files to create/change and the tests that prove each acceptance criterion.
   If the spec is ambiguous, choose the simplest reading that satisfies the acceptance
   criteria and note it in the Handoff Report. Ask the human only if the choice is
   irreversible (data model, public API shape, deleting data).
3. **Branch** — `git checkout main && git pull && git checkout -b <type>/<TASK-ID>-<slug>`
   e.g. `feat/BE-03-workouts-api`, `fix/FE-05-empty-states`.
4. **Test first where practical** — write the failing test for each acceptance criterion,
   then implement until it passes.
5. **Implement** — smallest change that meets the spec. No unrelated refactors, no scope creep.
   Anything extra you notice goes in "follow-ups", not in the diff.
6. **Self-check** — run `npm run lint && npm run typecheck && npm test` in every package you touched.
7. **Commit** — Conventional Commits, one logical change per commit (Section 3.4).
8. **Handoff** — send the Handoff Report to the Release Agent.

---

## 3. Development Practices

### 3.1 General
- **TypeScript everywhere**, `strict: true`. No `any` (use `unknown` + narrowing). No `@ts-ignore`;
  `@ts-expect-error` only with a comment explaining why.
- **Validate at the boundary.** Every HTTP request body/params/query, every env var, and every
  piece of imported/stored JSON is parsed with **Zod**. Inside the boundary, trust the types.
- **Single source of truth for data shapes:** Zod schemas live in `shared/` and both frontend
  and backend import types from them (`z.infer`). Do not hand-duplicate interfaces.
- Small, focused functions and files (aim < 300 lines per file). Pure logic (calculations,
  formatting, unit conversion) lives in plain functions that are unit-tested, not inside components
  or route handlers.
- Names describe intent (`estimateOneRepMax`, not `calc`). Comments explain *why*, not *what*.
- No dead code, no commented-out code, no `console.log` left in committed code
  (backend uses the logger; frontend has none in production).
- Dates: store calendar days as `yyyy-mm-dd` strings (`ISODate`), timestamps as ISO-8601 UTC.
  Weights are stored in **kg** in the database; convert for display only.

### 3.2 Security
- Never commit secrets. Config comes from env vars; commit `.env.example`, never `.env`.
- Passwords hashed with **argon2id**. Never log passwords, tokens, or full request bodies.
- Auth via short-lived JWT in an **httpOnly, Secure, SameSite=Lax cookie** — never in localStorage.
- Every data query is scoped by `userId` from the verified session — a user can never read or
  modify another user's rows (this must be covered by tests).
- Use parameterised queries only (Prisma does this; no raw SQL string concatenation).
- Security headers (`@fastify/helmet`), CORS restricted to the configured frontend origin,
  rate limiting on auth routes.
- `npm audit --omit=dev --audit-level=high` must be clean.

### 3.3 Error handling
- Backend returns errors as `{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details"?: ... } }`
  with correct HTTP status (400 validation, 401 unauthenticated, 403 forbidden, 404 not found,
  409 conflict, 429 rate-limited, 500 unexpected). Never leak stack traces in production.
- Frontend: every data-loading view has **loading, error, and empty** states. Errors show a
  human message and a retry action. Mutations show success/failure feedback.

### 3.4 Git
- Branch per task (see Section 2). Never commit directly to `main`. Never force-push `main`.
- Conventional Commits: `feat(api): add workouts CRUD`, `fix(web): …`, `test: …`, `chore: …`,
  `docs: …`, `refactor: …`. Reference the task ID in the body: `Task: BE-03`.
- Do not commit build output (`dist/`), `node_modules/`, `.env`, coverage reports, or Playwright artifacts.
- PRs are squash-merged; the squash title is the task ID + title.

### 3.5 Accessibility & UX (frontend)
- Semantic HTML first (`button`, `label`, `nav`, `main`, headings in order).
- Every input has a `<label>`; every icon-only control has an `aria-label`.
- Fully keyboard-operable; visible focus styles; colour contrast WCAG AA.
- Responsive from **360 px** to desktop with no horizontal scroll.
- Respect `prefers-reduced-motion` and `prefers-color-scheme`.

### 3.6 Performance
- Frontend production bundle: initial JS ≤ 250 KB gzipped; lazy-load route pages.
- API p95 latency under 200 ms for CRUD on a local DB; list endpoints are paginated or date-bounded.
- Add DB indexes for every `(userId, date)` lookup.

---

## 4. Technologies

Use these. Adding a dependency not on this list requires a one-line justification in the
Handoff Report (what it does, why existing tools can't, size/maintenance check).

### 4.1 Repository layout

```
ironlog/
├── src/                  # Frontend (React app) — existing
├── e2e/                  # Playwright end-to-end tests
├── shared/               # Zod schemas + inferred types shared by web and server
├── server/               # Backend (Fastify API)
│   ├── src/
│   │   ├── app.ts        # buildApp() — creates Fastify instance (used by tests)
│   │   ├── server.ts     # entrypoint: buildApp().listen()
│   │   ├── env.ts        # Zod-validated env
│   │   ├── plugins/      # auth, db, error handler, security
│   │   └── routes/       # one folder per resource: routes + service + tests
│   ├── prisma/schema.prisma
│   └── package.json
├── docker-compose.yml    # Postgres for dev + test
├── .github/workflows/ci.yml
├── PRODUCTION_RULES.md
└── TASKS.md
```

### 4.2 Frontend

| Concern | Technology |
|---|---|
| Runtime / build | **Vite 6**, **React 19**, **TypeScript 5.8+** (strict) |
| Routing | **react-router-dom 6** (existing) |
| Server state / data fetching | **TanStack Query v5** |
| Forms & validation | Controlled components + **Zod** schemas from `shared/` |
| Charts | **Recharts** (existing) |
| Styling | Existing plain CSS in `src/index.css` with CSS custom properties (design tokens). No new CSS framework. |
| Unit / component tests | **Vitest** + **@testing-library/react** + **@testing-library/user-event** + **jsdom** |
| API mocking in tests | **MSW (Mock Service Worker) v2** |
| End-to-end tests | **Playwright** (Chromium + mobile viewport) |
| Accessibility tests | **@axe-core/playwright** in e2e |
| Lint / format | **ESLint 9** (existing flat config) + **Prettier** |

### 4.3 Backend

| Concern | Technology |
|---|---|
| Runtime | **Node.js 26 LTS** (ESM) |
| HTTP framework | **Fastify 5** |
| Validation | **Zod** via `fastify-type-provider-zod` |
| Database | **PostgreSQL 16** (Docker in dev/test) |
| ORM / migrations | **Prisma** (`prisma migrate`) |
| Auth | `@fastify/jwt` + `@fastify/cookie`, **argon2** (argon2id) password hashing |
| Security | `@fastify/helmet`, `@fastify/cors`, `@fastify/rate-limit` |
| Logging | **pino** (Fastify built-in), JSON in production, redaction of auth headers/cookies |
| API docs | `@fastify/swagger` + `@fastify/swagger-ui` at `/docs` (dev only) |
| Dev runner / build | **tsx** (dev watch), **tsup** (production bundle) |
| Tests | **Vitest** + Fastify `app.inject()` against a real Postgres test database |
| Lint / format | ESLint 9 + typescript-eslint + Prettier |

### 4.4 Tooling / CI
- **GitHub Actions** (`.github/workflows/ci.yml`) runs on every push and PR: install → lint →
  typecheck → unit/integration tests with coverage → build → e2e → audit. Postgres runs as a
  service container.
- **Docker Compose** provides `postgres` for local dev (`ironlog_dev`) and tests (`ironlog_test`).
- `gh` CLI is used by the Release Agent to open and merge PRs.

---

## 5. Testing Standards

### 5.1 Test types (all required where applicable)

| Type | Scope | Where | Tool |
|---|---|---|---|
| Unit | Pure functions (utils, calculations, unit conversion, schema parsing) | next to the code: `*.test.ts` | Vitest |
| Component | A page/component renders and reacts to user input, with API mocked | `src/**/*.test.tsx` | Vitest + RTL + MSW |
| API integration | Each endpoint: success, validation failure, unauthenticated, other user's data (403/404) | `server/src/routes/**/*.test.ts` | Vitest + `app.inject()` + test DB |
| End-to-end | Critical user journeys through real frontend + real backend | `e2e/*.spec.ts` | Playwright |
| Accessibility | No serious/critical axe violations on every page | `e2e/a11y.spec.ts` | axe-core |

### 5.2 Rules
- Every acceptance criterion in a task maps to at least one test. Name tests after the behaviour:
  `it('rejects a set with negative reps')`.
- Every bug fix includes a regression test that fails before the fix.
- Tests are deterministic: no real network, fixed clock (`vi.useFakeTimers` / `vi.setSystemTime`)
  where dates matter, DB reset between test files. No `sleep`-based waits — use proper awaits.
- Never skip, `.only`, or weaken a test to make the suite pass. A `.skip` requires a linked
  follow-up task and Release Agent approval.
- **Coverage thresholds** (enforced in Vitest config, CI fails below them):
  - `shared/`, `src/utils.ts`, backend services: **≥ 90 % lines, ≥ 85 % branches**
  - Overall frontend and backend: **≥ 80 % lines, ≥ 75 % branches**

### 5.3 Critical e2e journeys (must always pass before production)
1. Register → log in → land on Dashboard.
2. Log a workout with 2 exercises and 3 sets each → it appears in history → PR is shown.
3. Add foods to two meals → Dashboard macros update.
4. Add a weigh-in → Progress chart shows it.
5. Add a health entry → appears in Health log.
6. Change unit kg ↔ lb in Settings → weights display converted everywhere.
7. Export backup → import it into a fresh account → data matches.
8. Log out → protected pages redirect to login.

---

## 6. Production Gate (Release Agent runs all, in order)

Run from a **clean checkout** of the branch. Every command must exit 0.

```bash
docker compose up -d postgres            # test database
npm ci && npm --prefix server ci
npm run lint && npm --prefix server run lint
npm run typecheck && npm --prefix server run typecheck
npm --prefix server run db:migrate:test  # apply migrations to ironlog_test
npm run test:coverage                    # frontend + shared, thresholds enforced
npm --prefix server run test:coverage    # backend, thresholds enforced
npm run build && npm --prefix server run build
npm run test:e2e                         # boots API + web, runs Playwright incl. axe
npm audit --omit=dev --audit-level=high && npm --prefix server audit --omit=dev --audit-level=high
git status --porcelain                   # must be empty except intended changes (no stray files)
```

Then, after push: **GitHub Actions CI must be green** before merge (`gh pr checks --watch`).

> Until a task introduces a script (e.g. `test:e2e` before FE-07), that gate is reported as
> "N/A — introduced in <TASK-ID>", not as passed.

---

## 7. Rules Compliance Checklist (Release Agent verifies before pushing)

- [ ] Work is on a correctly named feature branch, not `main`.
- [ ] Diff only touches what the task requires (no unrelated changes, no scope creep).
- [ ] Every acceptance criterion is met **and** covered by a named test.
- [ ] All Production Gate commands (Section 6) pass.
- [ ] Coverage thresholds met; no `.skip` / `.only` added.
- [ ] No `any`, `@ts-ignore`, `console.log`, commented-out code, or TODOs without a task ID.
- [ ] Inputs validated with Zod at every boundary; shared types come from `shared/`.
- [ ] Auth-protected endpoints tested for unauthenticated + cross-user access.
- [ ] No secrets, `.env`, `dist/`, coverage or test artifacts committed.
- [ ] New dependencies are on the approved list or justified in the Handoff Report.
- [ ] UI changes: loading/error/empty states, labels, keyboard access, 360 px layout checked.
- [ ] Commits follow Conventional Commits and reference the task ID.
- [ ] `README.md` updated if setup, scripts, env vars or features changed.
- [ ] `TASKS.md` status updated to `[x]` for this task.

Only when **every box is checked** does the Release Agent push and open the PR.

---

## 8. Definition of Done

A task is done when: it is merged to `main` via PR, CI is green on `main` after merge, its
acceptance criteria are verified, and `TASKS.md` shows it as `[x]`.
