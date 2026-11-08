# IronLog — Production Rules

Source of truth for how IronLog is built, tested, documented and shipped. Every task in
[`TASKS.md`](./TASKS.md) runs under these rules. If a task and this file disagree, this file
wins: stop and ask the owner.

---

## 1. Rules of Engagement

### 1.1 The owner decides

- **Nothing runs unless the owner asks.** A task starts only when the owner runs
  `/code-task <id>` (e.g. `/code-task tf01`, `/code-task tb03`). Agents never pick, start, or
  chain the next task on their own.
- **Every merge is authorized by the owner.** Agents push branches and open pull requests;
  they never merge, never push to `main`, never tag or release. All production decisions
  belong to the owner.
- **Do exactly what the task asks — nothing more.** No extra features, refactors, files,
  dependencies or comments beyond the task's spec.
- **Stay inside the task's files.** Only create or modify files the task names or that its
  spec necessarily requires. If any other file needs to change, **stop and ask the owner first**.
- **No AI attribution.** No `Co-Authored-By` trailers, "Generated with…" lines, or AI mentions in
  code, comments, commits, PRs or docs.

### 1.2 Task IDs

| Prefix | Area                             | Example         |
| ------ | -------------------------------- | --------------- |
| `TF`   | Frontend (and repo-wide tooling) | `TF01`, `TF12`  |
| `TB`   | Backend                          | `TB01`, `TB100` |

IDs are case-insensitive in the command (`tf01` = `TF01`).

### 1.3 Two agents

|              | **Agent 1 — Builder**                 | **Agent 2 — Release** (tester, documenter, publisher)                         |
| ------------ | ------------------------------------- | ----------------------------------------------------------------------------- |
| Purpose      | Implements the requested task to spec | Proves the task is correct and nothing else broke; documents it; opens the PR |
| Feature code | ✅ Writes it                          | ❌ Never edits it                                                             |
| Tests        | ✅ Writes tests for its own code      | ✅ Runs the full suite; may add missing regression tests                      |
| Docs         | ❌                                    | ✅ Updates `docs/` after all tests pass                                       |
| Push / PR    | ❌ Never                              | ✅ Pushes the task branch and opens the PR                                    |
| Merge        | ❌ Never                              | ❌ Never — the owner merges                                                   |

### 1.4 Workflow

```
 owner: /code-task tf01
        │
        ▼
 ┌──────────────┐  handoff report  ┌──────────────┐  all tests pass  ┌──────────────┐
 │   Agent 1    │ ───────────────▶ │   Agent 2    │ ───────────────▶ │ docs + push  │
 │   Builder    │ ◀─────────────── │   Release    │                  │ + PR opened  │
 └──────────────┘  failure report  └──────────────┘                  └──────┬───────┘
                                                                            ▼
                                                                  owner reviews & merges
```

1. Owner runs `/code-task <id>`. The task's dependencies must be `[x]` on `main`; otherwise stop and report.
2. **Agent 1** branches from `main`, implements the task, writes its tests, runs the quick checks
   for the touched package (`lint`, `typecheck`, `test`), commits, and returns a **Handoff Report** (§1.5).
3. **Agent 2** runs the full **Production Gate** (§6) from a clean checkout, verifies every
   acceptance criterion against its expected result, confirms **nothing else in the system broke**
   (whole test suite + build, not only the task's tests), and walks the **Compliance Checklist** (§7).
4. Any failure → **Failure Report** to Agent 1 (gate, exact command, exact output, what to fix).
   Agent 1 fixes only that. Back to step 3. After **3 failed cycles**, stop and report to the owner.
5. All green → Agent 2 updates documentation (§8), sets the task to `[x]` in `TASKS.md`, pushes the
   branch, opens the PR with the **Validation Report** (§1.6), waits for CI, and reports the PR link
   to the owner. **Then stops.**

### 1.5 Handoff Report (Agent 1 → Agent 2)

```markdown
## Handoff: <ID> <title>
Branch: <branch>
Summary: <2–5 lines>
Files changed: <list>
Acceptance criteria:
- [x] AC1 — <where tested>
Tests added: <files>
Local checks: lint ✅ typecheck ✅ test ✅
Out-of-scope findings (not changed): <or "none">
```

### 1.6 Validation Report (Agent 2 → PR body)

```markdown
## Validation: <ID> <title>
| Gate | Command | Result |
|---|---|---|
| Install | npm ci | ✅ |
| Lint | npm run lint | ✅ |
| Format | npm run format:check | ✅ |
| Typecheck | npm run typecheck | ✅ |
| Tests (full suite) | npm run test:coverage | ✅ N passed, lines X% |
| E2E | npm run test:e2e | ✅ / N/A (introduced in <ID>) |
| Build | npm run build | ✅ |
| Audit | npm audit --omit=dev --audit-level=high | ✅ |
| CI | GitHub Actions | ✅ |
Acceptance criteria: N/N met. Regressions: none. Docs updated: <files>.
```

---

## 2. Process of Creation

1. **Read** only the task, these rules, and the files the task touches.
2. **Plan** the smallest change that meets every acceptance criterion. If an ambiguity affects the
   data model or public API, or deletes data, ask the owner.
3. **Branch**: `git checkout main && git pull && git checkout -b <type>/<id>-<slug>`
   (e.g. `feat/tb03-auth`, `test/tf01-test-harness`).
4. **Test first** for each acceptance criterion, then implement until green.
5. **Commit**: Conventional Commits, body `Task: <ID>`, no AI attribution.
6. **Handoff** to Agent 2.

---

## 3. Development Practices

### 3.1 Code

- TypeScript `strict`. No `any`, no `@ts-ignore`.
- **Minimal code.** Reuse existing functions and components before writing new ones. No speculative
  abstractions, no unused exports, no dead or commented-out code, no `console.log`.
- **Comments only when the code cannot explain itself** (a non-obvious reason or constraint).
  No comments that restate the code.
- Validate every boundary input (HTTP body/params/query, env vars, stored/imported JSON) with
  **Zod**. Data shapes come from `shared/`; never redefine them.
- Weights are stored in **kg**, lengths in **cm**; convert for display only. Calendar days are
  `yyyy-mm-dd`; timestamps are ISO-8601 UTC.

### 3.2 Naming (standard TypeScript conventions)

| Kind                                         | Convention                                   | Example                               |
| -------------------------------------------- | -------------------------------------------- | ------------------------------------- |
| Variables, functions, object keys            | `camelCase`                                  | `targetWeight`, `estimateOneRepMax()` |
| Types, interfaces, classes, React components | `PascalCase`                                 | `Workout`, `FoodEntry`, `Dashboard`   |
| Module-level constants                       | `UPPER_SNAKE_CASE`                           | `STORAGE_KEY`, `MEALS`                |
| Booleans                                     | `is` / `has` / `can` prefix                  | `isLoading`, `hasSession`             |
| Component files                              | `PascalCase.tsx`                             | `Workouts.tsx`                        |
| Other modules                                | `camelCase.ts`                               | `units.ts`, `client.ts`               |
| Tests                                        | `<file>.test.ts(x)`, e2e `<journey>.spec.ts` | `units.test.ts`                       |
| Prisma                                       | `PascalCase` models, `camelCase` fields      | `WorkoutSet.weight`                   |
| URLs                                         | lowercase, plural nouns, kebab-case          | `/api/v1/health-entries`              |

### 3.3 Error handling (standard, no custom error codes)

- **Do not invent error codes.** Use standard **HTTP status codes** only:
  400 invalid input, 401 not authenticated, 403 not allowed, 404 not found, 409 conflict,
  413 payload too large, 429 too many requests, 500 unexpected.
- Error bodies follow **RFC 9457 Problem Details** (`Content-Type: application/problem+json`):
  `{ "type": "about:blank", "title": "Not Found", "status": 404, "detail": "Workout not found" }`.
  Validation errors may add an `errors` array of `{ path, message }`.
- The backend throws standard HTTP errors (`@fastify/sensible` `httpErrors`), and one global error
  handler formats them. Never expose stack traces, SQL or internal messages outside development.
- The frontend uses one `ApiError` (`status`, `title`, `detail`) parsed from Problem Details, and
  shows `detail` or a generic message by status. Every data view has loading, error (with retry)
  and empty states.

### 3.4 Security

- **The frontend never talks to the backend directly.** All browser traffic goes to a single
  origin: a **reverse proxy (gateway)** serves the static frontend and forwards only `/api/v1/*` to
  the API on a private network. The API port and the database are never exposed publicly. The
  frontend never imports server code, never holds secrets, and never knows the API's internal address.
- Secrets only in env vars; commit `.env.example`, never `.env`.
- Passwords: **argon2id**. Sessions: JWT in an **httpOnly, Secure, SameSite=Strict** cookie,
  never in localStorage or other JS-readable storage.
- Every query is scoped by the authenticated `userId`; cross-user access returns 404 (tested).
- Prisma parameterised queries only; no string-built SQL.
- Headers via `@fastify/helmet` (including CSP). CORS disabled (same origin). CSRF protection on
  state-changing requests (SameSite=Strict plus an `Origin` check).
- Rate limiting globally and stricter on auth routes; request body size limits.
- Logs redact `authorization`, `cookie`, `set-cookie` and `password`.
- Never use `dangerouslySetInnerHTML`.
- `npm audit --omit=dev --audit-level=high` clean; dependencies pinned via the lockfile.
- OWASP Top 10 is the review baseline for every backend task.

### 3.5 Git

- One branch per task, from `main`. Never commit to or push `main`. Never force-push a pushed branch.
- Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`, `ci:`, `refactor:`, `style:`),
  body `Task: <ID>`.
- Never commit `dist/`, `node_modules/`, `.env`, coverage or test artifacts.

### 3.6 Accessibility and performance (frontend)

- Semantic HTML, labelled inputs, `aria-label` on icon-only controls, keyboard operable, WCAG AA contrast.
- Responsive from 360 px with no horizontal scroll.
- Initial JS ≤ 250 KB gzipped; route pages lazy-loaded.

### 3.7 Resource budget

- Agents read only the files the task needs; no repo-wide exploration.
- Agent 1 runs only the touched package's checks; Agent 2 runs the full gate **once** per cycle.
- No new dependency unless the task requires it and no existing one can do the job.
- Prefer the smallest diff that satisfies the acceptance criteria.

---

## 4. Technologies

### 4.1 Layout

```
ironlog/
├── src/            # Frontend (React)
├── shared/         # Zod schemas + types used by frontend and backend
├── server/         # Backend (Fastify API)
├── e2e/            # Playwright tests
├── deploy/         # Gateway (reverse proxy) config
├── docs/           # Documentation system (§8)
├── docker-compose.yml
├── PRODUCTION_RULES.md
└── TASKS.md
```

### 4.2 Frontend

Vite 6 · React 19 · TypeScript 5.8+ · react-router-dom 6 · TanStack Query v5 · Zod · Recharts ·
plain CSS with custom properties (no CSS framework) · Vitest + Testing Library + MSW v2 ·
Playwright + @axe-core/playwright · ESLint 9 + Prettier.

### 4.3 Backend

Node.js 26 LTS (ESM) · Fastify 5 · `fastify-type-provider-zod` · `@fastify/sensible` ·
PostgreSQL 16 · Prisma · `@fastify/jwt` + `@fastify/cookie` · argon2 · `@fastify/helmet` ·
`@fastify/rate-limit` · pino · `@fastify/swagger` (dev only) · tsx (dev) · tsup (build) ·
Vitest with `app.inject()` against a real Postgres test database.

### 4.4 Gateway and CI

- **Caddy 2** reverse proxy: serves `dist/`, proxies `/api/v1/*` to the API, adds TLS in production.
  In development, the Vite dev server proxies `/api` the same way.
- Docker Compose for Postgres (dev/test) and the production stack (gateway + API + DB on a private network).
- GitHub Actions: install → lint → format → typecheck → tests + coverage → build → e2e → audit.

---

## 5. Testing Standards

| Type            | Scope                                            | Tool                              |
| --------------- | ------------------------------------------------ | --------------------------------- |
| Unit            | Pure functions, schemas, conversions             | Vitest                            |
| Component       | Pages/components with the API mocked             | Vitest + Testing Library + MSW    |
| API integration | Each endpoint: success, 400, 401, cross-user 404 | Vitest + `app.inject()` + test DB |
| End-to-end      | Critical journeys through gateway → API → DB     | Playwright                        |
| Accessibility   | No serious/critical violations                   | axe-core                          |

- Every acceptance criterion maps to a named test.
- Every bug fix ships with a regression test.
- Deterministic tests: fixed clock where dates matter, no real network, DB reset per test file.
- Never skip, `.only`, or weaken a test to make it pass.
- Coverage: `shared/`, utilities and backend services ≥ 90 % lines / 85 % branches; overall ≥ 80 % / 75 %.

**Critical e2e journeys:** register → login → dashboard · log a workout and see the PR · add foods and
see macros update · add a weigh-in and see the chart · add a health entry · switch kg ↔ lb and see
converted values · export then import a backup · logout redirects protected pages to login.

---

## 6. Production Gate (Agent 2, clean checkout, every command exits 0)

```bash
npm ci && npm --prefix server ci
npm run lint && npm --prefix server run lint
npm run format:check
npm run typecheck && npm --prefix server run typecheck
docker compose up -d postgres && npm --prefix server run db:migrate:test
npm run test:coverage && npm --prefix server run test:coverage
npm run build && npm --prefix server run build
npm run test:e2e
npm audit --omit=dev --audit-level=high && npm --prefix server audit --omit=dev --audit-level=high
git status --porcelain
```

A gate whose script does not exist yet is reported as `N/A (introduced in <ID>)`.
After the push, GitHub Actions must be green before the PR is handed to the owner.

---

## 7. Compliance Checklist (Agent 2)

- [ ] The task was started by the owner's `/code-task` command; no other task was touched.
- [ ] Branch named `<type>/<id>-<slug>`, based on `main`.
- [ ] The diff touches only files the task requires; nothing extra was added.
- [ ] Every acceptance criterion is met and covered by a named test; full suite green (no regressions).
- [ ] All §6 gates pass; coverage thresholds met; no `.skip` / `.only`.
- [ ] No `any`, `@ts-ignore`, `console.log`, dead code or unnecessary comments.
- [ ] Naming follows §3.2; errors follow §3.3 (HTTP status + Problem Details, no custom codes).
- [ ] Security rules (§3.4) respected; auth endpoints tested for 401 and cross-user access.
- [ ] No secrets or build/test artifacts committed; no unjustified dependencies.
- [ ] No AI attribution in code, comments, commits, PR or docs.
- [ ] Documentation updated per §8.
- [ ] `TASKS.md` status set to `[x]`.

---

## 8. Documentation System

Agent 2 updates documentation **after all tests pass**, in the same PR, as a `docs:` commit.
Structure, templates and writing rules are defined in [`docs/README.md`](./docs/README.md).

- Create a doc file only when the first task that needs it lands; never pre-write sections for
  features that do not exist.
- Update only the sections affected by the task; remove anything the task made stale.
- Every task adds `docs/tasks/<ID>.md` and a `docs/CHANGELOG.md` entry.

---

## 9. Definition of Done

All gates and checklist items pass, docs are updated, the PR is open with CI green, and the
owner has reviewed and merged it.
