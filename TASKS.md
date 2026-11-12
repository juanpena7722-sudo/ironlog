# IronLog — Task Backlog

Tasks run only when the owner types `/code-task <id>` (e.g. `/code-task tf01`). Rules:
[`PRODUCTION_RULES.md`](./PRODUCTION_RULES.md). Agent 1 builds; Agent 2 tests, documents and
opens the PR; **the owner merges**.

**Goal:** turn IronLog from a browser-only app (localStorage) into a production app with a backend,
user accounts and a database, keeping every existing feature.

### Status legend

`[ ]` not started · `[~]` building (Agent 1) · `[?]` verifying (Agent 2) · `[x]` verified, PR open/merged · `[!]` blocked

A task can start only when every task in **Depends on** is merged into `main`.

| ID   | Task                                           | Depends on                   |
| ---- | ---------------------------------------------- | ---------------------------- |
| TF00 | Foundation: tooling, shared schemas, CI        | —                            |
| TB01 | Server scaffold                                | TF00                         |
| TB02 | Database schema and migrations                 | TB01                         |
| TB03 | Authentication                                 | TB02                         |
| TB04 | Workouts API                                   | TB03                         |
| TB05 | Food log API                                   | TB03                         |
| TB06 | Body and health API                            | TB03                         |
| TB07 | Goals API                                      | TB03                         |
| TB08 | Backup export/import API                       | TB04, TB05, TB06, TB07       |
| TB09 | Hardening, gateway and production stack        | TB08                         |
| TF01 | Frontend test harness and existing-logic tests | TF00                         |
| TF02 | API client and TanStack Query                  | TF01, TB01                   |
| TF03 | Auth screens and protected routes              | TF02, TB03                   |
| TF04 | Data layer on the API (kg canonical)           | TF03, TB04, TB05, TB06, TB07 |
| TF05 | Backup and local-data migration                | TF04, TB08                   |
| TF06 | UX states, accessibility, performance          | TF04                         |
| TF07 | End-to-end and accessibility suite in CI       | TF05, TF06, TB09             |

Releases (versioning, tags, deployment) are decided and triggered by the owner only.

---

## Frontend Tasks (TF)

### [x] TF00 — Foundation: tooling, shared schemas, CI

**Branch:** `chore/SH-01-foundation` (created before the ID scheme; formerly SH-01)

**Spec**

- Prettier + `eslint-config-prettier`; scripts `format`, `format:check`, `typecheck`, `test`, `test:coverage`.
- Vitest with coverage thresholds per PRODUCTION_RULES §5.
- `shared/schemas.ts`: Zod schemas for every type in `src/types.ts`; `src/types.ts` re-exports them.
  Alias `@shared/*` in Vite and tsconfig.
- Rules: reps integer 0–1000, weight 0–2000, calories/macros ≥ 0, real `yyyy-mm-dd` dates,
  energy integer 1–5, trimmed names ≤ 100, notes ≤ 2000.
- `.github/workflows/ci.yml`: npm ci, lint, format:check, typecheck, test:coverage, build, audit.
- `.env.example`; `.gitignore` covers `.env`, `coverage/`, `playwright-report/`, `test-results/`.

**Acceptance criteria**

1. All scripts pass on a clean checkout.
2. `shared/schemas.test.ts` covers valid and invalid cases for every schema (≥ 90 %).
3. No UI or behaviour change.
4. CI passes on GitHub.

### [x] TF01 — Frontend test harness and existing-logic tests

**Branch:** `test/tf01-test-harness`

**Spec**

- Testing Library, user-event, jsdom, MSW v2; one test setup file.
- Unit tests for every export of `src/utils.ts` (fixed system time) and `normalize()` in `src/store.tsx`.
  Add `src/utils.ts` to coverage.
- One smoke test per page.
- Lazy-load route pages with `React.lazy` + `Suspense`.

**Acceptance criteria**

1. `src/utils.ts` ≥ 90 % lines / 85 % branches.
2. Each of the 6 pages has a passing smoke test.
3. The build emits a separate chunk per page.

### [x] TF02 — API client and TanStack Query

**Branch:** `feat/tf02-api-client`

**Spec**

- `src/api/client.ts`: `fetch` wrapper with the fixed relative base `/api/v1` (same origin only,
  no configurable backend URL), `credentials: 'same-origin'`. It parses RFC 9457 Problem Details into
  `ApiError` (`status`, `title`, `detail`) and validates responses with shared schemas.
- Vite dev proxy `/api` → `http://localhost:3000` (development stand-in for the gateway).
- `QueryClientProvider` in `main.tsx`: retry once on 5xx only.
- MSW handlers in `src/test/handlers.ts`.

**Acceptance criteria**

1. Tests: success parse, Problem Details → `ApiError`, malformed response rejected, network failure surfaced.

### [x] TF03 — Auth screens and protected routes

**Branch:** `feat/tf03-auth-ui`

**Spec**

- `/login` and `/register` in the existing style; client validation from shared schemas; server `detail` shown inline.
- `useSession()` from `GET /auth/me`; unauthenticated users go to `/login`, then return to the original page.
- Logout in the nav; "Delete account" in Settings (confirm + password).

**Acceptance criteria**

1. Tests: register/login redirect, validation messages, 401 redirects to login, logout clears session and query cache.
2. Forms are fully keyboard operable.

### [x] TF04 — Data layer on the API (kg canonical)

**Branch:** `feat/tf04-api-data-layer`

**Spec**

- Replace localStorage persistence in `src/store.tsx` with query hooks (`useWorkouts`, `useFoods`, `useBody`,
  `useHealth`, `useGoals`) and mutations. Pages keep their behaviour and look.
- `src/units.ts`: `toDisplayWeight`, `fromDisplayWeight`, `toDisplayLength`, `fromDisplayLength`, used by
  every page, input and chart. Switching kg ↔ lb converts the values shown.

**Acceptance criteria**

1. Every README feature works against the API (component tests per page: list, create, edit, delete).
2. `src/units.ts` ≥ 90 % coverage; round trip stable to 0.1.
3. Entering 100 lb saves 45.36 kg; switching to kg shows 45.4.

### [x] TF05 — Backup and local-data migration

**Branch:** `feat/tf05-backup-migration`

**Spec**

- Settings export/import use `GET /backup` and `POST /backup/import` (merge or replace; replace needs confirmation).
- If `localStorage['ironlog:data']` holds data after login, offer a one-time import (`mode=merge`,
  `unitHint` = stored unit). On success, remove the local data; remember a dismissal.

**Acceptance criteria**

1. Tests: banner only with local data; success clears local data and refreshes; failure keeps local data and
   shows the error; replace requires confirmation.

### [x] TF06 — UX states, accessibility, performance

**Branch:** `feat/tf06-ux-a11y`

**Spec**

- Every page has loading, error (with retry) and empty states; feedback for every mutation.
- Accessibility per PRODUCTION_RULES §3.6 (including `aria-label` on the emoji nav icons).
- Layout checked at 360 / 768 / 1280 px. Initial JS ≤ 250 KB gzipped.

**Acceptance criteria**

1. Tests for loading, error + retry and empty states on each page.
2. Bundle size within budget (reported in the Handoff).

### [ ] TF07 — End-to-end and accessibility suite in CI

**Branch:** `test/tf07-e2e`

**Spec**

- Playwright runs against the production stack from TB09 (gateway → API → Postgres), Chromium desktop
  plus a 390×844 viewport.
- All critical journeys from PRODUCTION_RULES §5; `e2e/a11y.spec.ts` runs axe on every page.
- Script `test:e2e`; a CI job uploads the report on failure.

**Acceptance criteria**

1. All journeys pass locally and in CI, 3 consecutive runs without flakes.
2. No serious/critical axe violations.

---

## Backend Tasks (TB)

All endpoints live under `/api/v1`, return JSON, and report errors as RFC 9457 Problem Details with
standard HTTP status codes only (PRODUCTION_RULES §3.3). From TB03 on, every resource requires auth
and is scoped to the current user; another user's resource returns 404.

### [x] TB01 — Server scaffold

**Branch:** `feat/tb01-server-scaffold`

**Spec**

- `server/` package (ESM, Node 26, strict TS): ESLint, Prettier, Vitest, tsx, tsup. Scripts `dev`, `build`,
  `start`, `lint`, `typecheck`, `test`, `test:coverage`.
- `src/env.ts`: Zod-parsed `NODE_ENV`, `PORT` (3000), `DATABASE_URL`, `JWT_SECRET` (≥ 32 chars). Invalid env stops startup.
- `src/app.ts` exports `buildApp()`; `src/server.ts` starts it; it listens on the private network only.
- `@fastify/sensible`; a global error handler emits Problem Details (Zod → 400 with `errors`, unknown route → 404,
  unexpected → 500 without internals in production).
- `GET /api/v1/health` → `200 { status: "ok" }`.
- `docker-compose.yml` with `postgres:16` (databases `ironlog_dev`, `ironlog_test`); `server/.env.example`.
- Backend steps in CI with a Postgres service.

**Acceptance criteria**

1. Tests: health 200; 404, 400 and 500 return Problem Details; 500 hides internals in production; env rejects a short `JWT_SECRET`.

### [x] TB02 — Database schema and migrations

**Branch:** `feat/tb02-db-schema`

**Spec**

- Prisma models: `User` (uuid, unique lowercase email, passwordHash), `Goals` (1:1), `Workout` → `Exercise` → `WorkoutSet`
  (ordered), `FoodEntry`, `BodyEntry`, `HealthEntry`; all with `userId`, `createdAt`, `updatedAt`.
- Weights in kg as `Decimal(6,2)`, lengths in cm, calendar days as `date`. Index `(userId, date)`;
  `HealthEntry` unique on `(userId, date)`. Cascade deletes from `User` and `Workout`.
- Scripts `db:migrate`, `db:migrate:test`, `db:reset:test`, `db:seed` (demo user from `src/demo.ts` data).
- Prisma plugin (`app.db`) closed on shutdown; a test helper truncates tables between files.

**Acceptance criteria**

1. Migrations create the schema from scratch and are committed.
2. Tests: CRUD per model, cascade delete, one health entry per day.

### [x] TB03 — Authentication

**Branch:** `feat/tb03-auth`

**Spec**

- `POST /auth/register` `{ email, password }` (password 10–128) → 201 + session cookie + default goals; duplicate email → 409.
- `POST /auth/login` → 200 + cookie; any wrong credential → 401 with the same generic detail.
- `POST /auth/logout` → 204; `GET /auth/me` → `{ id, email }` or 401; `DELETE /auth/account` (password required) → 204, deletes all data.
- JWT HS256, 7-day expiry, in an httpOnly, Secure, SameSite=Strict cookie. argon2id. A `requireAuth` hook sets `request.userId`.
- State-changing requests with a foreign `Origin` → 403. Auth routes limited to 10 requests/min per IP → 429.

**Acceptance criteria**

1. Tests: success paths; 400 invalid input; 401 wrong password and missing/expired/tampered token; 409 duplicate;
   403 foreign Origin; 429 rate limit; account deletion removes all rows.
2. The password hash never appears in a response or log (asserted).

### [x] TB04 — Workouts API

**Branch:** `feat/tb04-workouts-api`

**Spec**

- `GET /workouts?from=&to=` (inclusive, default last 90 days, newest first), `GET /workouts/:id`,
  `POST /workouts` (nested exercises and sets, transactional), `PUT /workouts/:id` (full replace, transactional),
  `DELETE /workouts/:id` → 204. Responses match the shared `Workout` schema with order preserved.

**Acceptance criteria**

1. Tests: CRUD, date filter, 400, 401, 404, cross-user 404.
2. A PUT with fewer exercises removes the dropped ones.

### [x] TB05 — Food log API

**Branch:** `feat/tb05-foods-api`

**Spec**

- `GET /foods?from=&to=` (default last 30 days), `POST`, `PUT /:id`, `DELETE /:id`; `meal` ∈ `MEALS`.
- `GET /foods/recent?limit=` (default 20, max 50): distinct names, most recent first.

**Acceptance criteria**

1. Same test set as TB04; `recent` is de-duplicated and respects `limit`.

### [x] TB06 — Body and health API

**Branch:** `feat/tb06-body-health-api`

**Spec**

- Body: `GET /body?from=&to=`, `POST`, `PUT /:id`, `DELETE /:id`.
- Health: `GET /health-entries?from=&to=`, `PUT /health-entries/:date` (upsert), `DELETE /health-entries/:date`.

**Acceptance criteria**

1. Same test set as TB04 for both resources; an upsert on an existing date updates it.

### [x] TB07 — Goals API

**Branch:** `feat/tb07-goals-api`

**Spec**

- `GET /goals`, `PUT /goals` (full `Goals`; `targetWeight` in kg; `unit` is the display preference).

**Acceptance criteria**

1. Tests: defaults for a new user, update persists, 400, 401.

### [x] TB08 — Backup export/import API

**Branch:** `feat/tb08-backup-api`

**Spec**

- `GET /backup` → `AppData` v1 as an attachment `ironlog-backup-YYYY-MM-DD.json`.
- `POST /backup/import?mode=merge|replace&unitHint=kg|lb` accepts `AppData` v1 (5 MB limit). `merge` inserts new ids;
  `replace` swaps all data in one transaction; `lb` converts weights to kg and inches to cm.
- Response: `{ imported: {...}, skipped: {...} }`.

**Acceptance criteria**

1. Round trip: export → import into a new user → export gives identical data (ignoring ids and timestamps).
2. Tests: invalid file 400, atomic replace, merge skips duplicates, lb→kg to 2 decimals, > 5 MB 413.

### [x] TB09 — Hardening, gateway and production stack

**Branch:** `feat/tb09-hardening-gateway`

**Spec**

- `@fastify/helmet` (with CSP), global rate limit 300/min/IP, body limits, pino redaction (§3.4),
  graceful shutdown, OpenAPI at `/docs` outside production only.
- `server/Dockerfile`: multi-stage, `node:26-alpine`, non-root, runs `prisma migrate deploy` on start.
- `deploy/Caddyfile`: serves `dist/`, proxies `/api/v1/*` to `api:3000`, SPA fallback, security headers.
- `docker-compose.prod.yml`: `gateway` (only published port), `api` and `db` on an internal network with no published ports.

**Acceptance criteria**

1. Tests: security headers present, redaction works, `/docs` 404 in production.
2. With the prod stack up, `/` serves the app and `/api/v1/health` returns 200 through the gateway; the API and DB ports are not reachable from the host.
