# IronLog — Task Backlog for Claude

Every task here is executed under [`PRODUCTION_RULES.md`](./PRODUCTION_RULES.md):
the **Builder Agent** implements, the **Release Agent** runs the full production gate and
compliance checklist, then pushes to GitHub and merges. One task at a time.

**Goal of this backlog:** turn IronLog from a browser-only app (localStorage) into a
production app with a real backend, user accounts, and a database — without losing any
existing feature.

### Status legend

`[ ]` not started · `[~]` in progress (Builder) · `[?]` in verification (Release Agent) · `[x]` merged to `main` · `[!]` blocked/escalated

### Execution order

A task may start only when every task in its **Depends on** is `[x]`.

| #   | Task                                                    | Area     | Depends on                        |
| --- | ------------------------------------------------------- | -------- | --------------------------------- |
| 1   | SH-01 Foundation: tooling, shared schemas, CI           | Shared   | —                                 |
| 2   | BE-01 Server scaffold                                   | Backend  | SH-01                             |
| 3   | BE-02 Database schema & migrations                      | Backend  | BE-01                             |
| 4   | BE-03 Authentication                                    | Backend  | BE-02                             |
| 5   | BE-04 Workouts API                                      | Backend  | BE-03                             |
| 6   | BE-05 Food log API                                      | Backend  | BE-03                             |
| 7   | BE-06 Body & Health API                                 | Backend  | BE-03                             |
| 8   | BE-07 Goals / settings API                              | Backend  | BE-03                             |
| 9   | BE-08 Backup export / import API                        | Backend  | BE-04, BE-05, BE-06, BE-07        |
| 10  | BE-09 Hardening, API docs, production image             | Backend  | BE-08                             |
| 11  | FE-01 Frontend test harness & existing-logic tests      | Frontend | SH-01                             |
| 12  | FE-02 API client & TanStack Query                       | Frontend | FE-01, BE-01                      |
| 13  | FE-03 Auth screens & protected routes                   | Frontend | FE-02, BE-03                      |
| 14  | FE-04 Move data layer to the API (kg canonical)         | Frontend | FE-03, BE-04, BE-05, BE-06, BE-07 |
| 15  | FE-05 Backup & local-data migration                     | Frontend | FE-04, BE-08                      |
| 16  | FE-06 UX states, accessibility, responsive, performance | Frontend | FE-04                             |
| 17  | FE-07 End-to-end & accessibility suite in CI            | Frontend | FE-05, FE-06, BE-09               |
| 18  | REL-01 Production release v1.0.0                        | Release  | all above                         |

> FE-01 can run in parallel with the BE track **only** in the sense of ordering — the
> two-agent rule still means one task is active at a time.

---

## 0. Shared Foundation

### [x] SH-01 — Foundation: tooling, shared schemas, CI

**Branch:** `chore/SH-01-foundation`

**Spec**

- Add **Prettier** (+ `eslint-config-prettier`) with a `format` and `format:check` script.
- Add `typecheck` script (`tsc -b --noEmit` or equivalent) to the root `package.json`.
- Add **Vitest** to the frontend with a `test` and `test:coverage` script; coverage thresholds per
  PRODUCTION_RULES §5.2.
- Create `shared/schemas.ts` with **Zod** schemas equivalent to every type in `src/types.ts`
  (`SetEntry`, `ExerciseEntry`, `Workout`, `FoodEntry`, `BodyEntry`, `HealthEntry`, `Goals`,
  `AppData`, `MEALS`, `MUSCLES`). Export inferred types.
- `src/types.ts` re-exports types from `shared/` (no duplicate definitions). Add Vite + tsconfig
  alias `@shared/*` → `shared/*`.
- Validation rules: reps integer 0–1000, weight 0–2000, calories/macros ≥ 0, `ISODate` matches
  `yyyy-mm-dd` and is a real date, `energy` integer 1–5, strings trimmed and length-limited
  (names ≤ 100, notes ≤ 2000).
- Add `.github/workflows/ci.yml` running: `npm ci`, lint, format:check, typecheck, test:coverage, build.
- Add `.env.example` (empty for now) and ensure `.gitignore` covers `.env`, `coverage/`,
  `playwright-report/`, `test-results/`.

**Acceptance criteria**

1. `npm run lint`, `format:check`, `typecheck`, `test`, `build` all pass on a clean checkout.
2. `shared/schemas.test.ts` covers valid and invalid samples for every schema (≥ 90 % coverage).
3. App still builds and behaves exactly as before (no UI changes).
4. CI workflow runs on push/PR and passes on GitHub.

---

## 1. Backend Tasks

All backend code lives in `server/`. All endpoints are under `/api/v1`, return JSON, and use the
error format from PRODUCTION_RULES §3.3. Every resource endpoint requires auth (from BE-03 on) and
is scoped to the current user.

### [ ] BE-01 — Server scaffold

**Branch:** `feat/BE-01-server-scaffold`

**Spec**

- `server/package.json` (ESM, Node 26), TypeScript strict, ESLint, Prettier, Vitest, tsx, tsup.
  Scripts: `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:coverage`.
- `src/env.ts`: Zod-parsed env — `NODE_ENV`, `PORT` (default 3000), `DATABASE_URL`,
  `JWT_SECRET` (min 32 chars), `CORS_ORIGIN`. App refuses to start with invalid env and prints
  which variable is wrong.
- `src/app.ts` exports `buildApp(opts)`; `src/server.ts` starts it. Use `fastify-type-provider-zod`.
- Global error handler producing the standard error shape; Zod errors → 400 `VALIDATION_ERROR`;
  unknown routes → 404 `NOT_FOUND`; unexpected → 500 `INTERNAL_ERROR` with no stack in production.
- `GET /api/v1/health` → `200 { status: "ok", version, uptimeSec }`.
- `docker-compose.yml` at repo root with `postgres:16` and two databases: `ironlog_dev`, `ironlog_test`.
- Update `server/.env.example` and README "Backend development" section.
- Add backend jobs to CI (Postgres service container).

**Acceptance criteria**

1. `npm --prefix server run dev` starts the API; `curl /api/v1/health` returns 200.
2. Tests: health endpoint, 404 shape, validation error shape, 500 shape hides stack in production,
   env parsing rejects missing/short `JWT_SECRET`.
3. All backend gate commands pass and CI is green.

### [ ] BE-02 — Database schema & migrations

**Branch:** `feat/BE-02-db-schema`

**Spec**

- Prisma schema for: `User` (id uuid, email unique lowercase, passwordHash, createdAt),
  `Goals` (1:1 with user, fields from `Goals`), `Workout` → `Exercise` (ordered) → `WorkoutSet` (ordered),
  `FoodEntry`, `BodyEntry`, `HealthEntry`. All rows have `userId`, `createdAt`, `updatedAt`.
- Weights (`WorkoutSet.weight`, `BodyEntry.weight`, `Goals.targetWeight`) stored in **kg**
  (`Decimal(6,2)`); measurements stored in **cm**.
- Calendar dates stored as Postgres `date`. Indexes on `(userId, date)` for every dated table.
  `HealthEntry` unique on `(userId, date)`.
- Cascading delete from `User` and from `Workout` to its exercises/sets.
- Scripts: `db:migrate` (dev), `db:migrate:test`, `db:reset:test`, `db:seed` (demo user using
  the data shape from `src/demo.ts`).
- Prisma client exposed as a Fastify plugin (`app.db`), closed on shutdown.
- Test helper that truncates all tables between test files.

**Acceptance criteria**

1. `prisma migrate dev` creates the schema from scratch; migration files committed.
2. Tests: create/read each model; cascade delete removes child rows; unique health-per-day enforced.
3. Seed script creates a demo user with workouts, foods, body and health entries.

### [ ] BE-03 — Authentication

**Branch:** `feat/BE-03-auth`

**Spec**

- `POST /api/v1/auth/register` `{ email, password }` → 201, sets session cookie, creates default `Goals`.
  Password: 10–128 chars. Duplicate email → 409 `EMAIL_TAKEN`.
- `POST /api/v1/auth/login` → 200 + cookie; wrong credentials → 401 `INVALID_CREDENTIALS`
  (same message for unknown email and wrong password).
- `POST /api/v1/auth/logout` → 204, clears cookie.
- `GET /api/v1/auth/me` → `{ id, email }` or 401.
- JWT (HS256, 7-day expiry) in `httpOnly`, `SameSite=Lax`, `Secure` (in production), `Path=/` cookie.
- argon2id hashing. `requireAuth` preHandler decorates `request.userId`.
- Rate limit: 10 requests/min per IP on `register` and `login` → 429.
- `DELETE /api/v1/auth/account` (requires password) deletes the user and all data.

**Acceptance criteria**

1. Tests for each endpoint: success, validation failure, wrong password, duplicate email,
   missing/expired/tampered token → 401, rate limit → 429, account deletion removes all rows.
2. Password hash never appears in any response or log (asserted in a test).

### [ ] BE-04 — Workouts API

**Branch:** `feat/BE-04-workouts-api`

**Spec**

- `GET /api/v1/workouts?from=&to=` (dates inclusive, default last 90 days, sorted date desc)
- `GET /api/v1/workouts/:id`
- `POST /api/v1/workouts` — full workout with nested exercises and sets (body = shared `Workout`
  schema minus `id`), created in one transaction.
- `PUT /api/v1/workouts/:id` — replaces the workout including exercises/sets (transactional).
- `DELETE /api/v1/workouts/:id` → 204.
- Response shape matches the shared `Workout` schema exactly (weights in kg, order preserved).

**Acceptance criteria**

1. Tests: CRUD happy paths, date-range filter, invalid body → 400, unknown id → 404,
   another user's workout → 404 (no existence leak), unauthenticated → 401.
2. Updating a workout with fewer exercises removes the dropped ones.

### [ ] BE-05 — Food log API

**Branch:** `feat/BE-05-foods-api`

**Spec**

- `GET /api/v1/foods?from=&to=` (default last 30 days), `POST`, `PUT /:id`, `DELETE /:id`.
- `GET /api/v1/foods/recent?limit=20` — distinct recent foods by name (for quick re-add).
- `meal` must be one of `MEALS`.

**Acceptance criteria**

1. Same test matrix as BE-04 (happy, 400, 401, 404, cross-user).
2. `recent` returns de-duplicated names, most recent first, respecting `limit` (max 50).

### [ ] BE-06 — Body & Health API

**Branch:** `feat/BE-06-body-health-api`

**Spec**

- Body: `GET /api/v1/body?from=&to=`, `POST`, `PUT /:id`, `DELETE /:id` (weight kg, measurements cm).
- Health: `GET /api/v1/health-entries?from=&to=`, `PUT /api/v1/health-entries/:date` (upsert by date),
  `DELETE /api/v1/health-entries/:date`.

**Acceptance criteria**

1. Same test matrix as BE-04 for both resources.
2. Upserting health for an existing date updates it instead of creating a duplicate.

### [ ] BE-07 — Goals / settings API

**Branch:** `feat/BE-07-goals-api`

**Spec**

- `GET /api/v1/goals` and `PUT /api/v1/goals` (full `Goals` object; `targetWeight` in kg;
  `unit` is the display preference only).

**Acceptance criteria**

1. Tests: defaults returned for a new user, update persists, invalid values → 400, 401 without auth.

### [ ] BE-08 — Backup export / import API

**Branch:** `feat/BE-08-backup-api`

**Spec**

- `GET /api/v1/backup` → full `AppData` (version 1) for the current user, as a download
  (`Content-Disposition: attachment; filename="ironlog-backup-YYYY-MM-DD.json"`).
- `POST /api/v1/backup/import?mode=merge|replace` accepts `AppData` v1 (the same format the current
  localStorage app exports). Validated with the shared schema; body limit 5 MB.
  - `merge`: insert entries whose `id` does not already exist for the user.
  - `replace`: delete all user data, then insert — in a single transaction.
  - `unitHint=kg|lb` query param: if `lb`, convert weights to kg on import (lb ÷ 2.20462) and
    inches → cm, because legacy local data was stored in the user's display unit.
- Response: `{ imported: { workouts, foods, body, health }, skipped: {...} }`.

**Acceptance criteria**

1. Round-trip test: export → import into a fresh user → export again → identical data (ignoring ids/timestamps).
2. Tests: invalid file → 400 with details, `replace` is atomic (forced failure leaves data intact),
   `merge` skips duplicates, lb→kg conversion correct to 2 decimals, > 5 MB → 413.

### [ ] BE-09 — Hardening, API docs, production image

**Branch:** `feat/BE-09-hardening`

**Spec**

- Register `@fastify/helmet`, `@fastify/cors` (only `CORS_ORIGIN`, credentials true),
  global rate limit (300/min/IP) in addition to auth limits.
- pino redaction of `authorization`, `cookie`, `set-cookie`, `password`.
- OpenAPI via `@fastify/swagger`, UI at `/docs` when `NODE_ENV !== 'production'`.
- Graceful shutdown on SIGTERM/SIGINT (stop accepting, finish in-flight, close DB).
- `server/Dockerfile` (multi-stage, non-root user, `node:26-alpine`), runs migrations on start
  via `prisma migrate deploy`.
- Optionally serve the built frontend `dist/` as static files from the API in production
  (`@fastify/static`) so one container serves the whole app.

**Acceptance criteria**

1. Tests: security headers present, disallowed origin rejected, redaction works (log capture),
   `/docs` 404 in production.
2. `docker build` succeeds and the container passes `/api/v1/health` against compose Postgres.

---

## 2. Frontend Tasks

The frontend is the existing React app in `src/`. Keep the current look and features; the
change is where data comes from. All data shapes come from `shared/`.

### [ ] FE-01 — Frontend test harness & existing-logic tests

**Branch:** `test/FE-01-test-harness`

**Spec**

- Add `@testing-library/react`, `@testing-library/user-event`, `jsdom`, **MSW v2**; test setup file.
- Unit tests for every exported function in `src/utils.ts` (dates, week start, totals, e1RM,
  volume, etc.) with a fixed system time, and for `normalize()` in `src/store.tsx`.
- Smoke component test per page (renders with demo data, key headings visible).
- Lazy-load route pages with `React.lazy` + `Suspense`.

**Acceptance criteria**

1. `src/utils.ts` ≥ 90 % lines / 85 % branches; overall frontend ≥ 80 % lines.
2. Each of the 6 pages has a passing smoke test.
3. Production build splits pages into separate chunks.

### [ ] FE-02 — API client & TanStack Query

**Branch:** `feat/FE-02-api-client`

**Spec**

- `src/api/client.ts`: typed `fetch` wrapper — base URL from `VITE_API_URL` (default `/api/v1`),
  `credentials: 'include'`, JSON parse, parses standard error shape into an `ApiError` class
  (`status`, `code`, `message`), validates responses with shared Zod schemas.
- Vite dev proxy `/api` → `http://localhost:3000`.
- `QueryClientProvider` in `main.tsx` with sensible defaults (retry 1 on 5xx only, no retry on 4xx).
- MSW handlers in `src/test/handlers.ts` mirroring the API contract for component tests.

**Acceptance criteria**

1. Tests: success parse, error shape → `ApiError`, malformed response → validation error,
   network failure surfaced, credentials included.

### [ ] FE-03 — Auth screens & protected routes

**Branch:** `feat/FE-03-auth-ui`

**Spec**

- `/login` and `/register` pages matching the existing visual style; client-side validation with
  shared schema; server errors shown inline (e.g. "Email already registered").
- `useSession()` hook backed by `GET /auth/me`. All existing routes require a session; unauthenticated
  users are redirected to `/login` and returned to the original page after login.
- Logout button in the nav; "Delete account" in Settings (confirm dialog + password).

**Acceptance criteria**

1. Component tests (MSW): successful register/login redirects, invalid input messages,
   401 on protected route redirects to login, logout clears session and cached queries.
2. Keyboard-only: forms can be completed and submitted.

### [ ] FE-04 — Move data layer to the API (kg canonical)

**Branch:** `feat/FE-04-api-data-layer`

**Spec**

- Replace localStorage persistence in `src/store.tsx` with TanStack Query hooks per resource
  (`useWorkouts`, `useFoods`, `useBody`, `useHealth`, `useGoals`) and mutations that invalidate
  or optimistically update caches. Pages keep the same behaviour and look.
- **Units:** all data from/to the API is kg/cm. Add `src/units.ts` (`toDisplayWeight`,
  `fromDisplayWeight`, `toDisplayLength`, `fromDisplayLength`) and use it in every page/input/chart.
  Switching kg ↔ lb in Settings now converts displayed values instead of relabelling them.
- Remove `localStorage` as a data store (keep it only for the FE-05 migration check).

**Acceptance criteria**

1. Every existing feature in README works against the real API (component tests with MSW for
   each page: list, create, edit, delete).
2. `src/units.ts` unit tests ≥ 90 % coverage; round-trip conversion is stable to 0.1.
3. Test: entering 100 lb saves 45.36 kg; switching to kg displays 45.4.

### [ ] FE-05 — Backup & local-data migration

**Branch:** `feat/FE-05-backup-migration`

**Spec**

- Settings → Export downloads from `GET /backup`; Import uploads to `POST /backup/import` with
  merge/replace choice and a confirmation for replace.
- On first login, if `localStorage['ironlog:data']` has data, show a one-time banner:
  "Import your existing on-device data into your account?" → calls import with `mode=merge` and
  `unitHint` = the stored unit. On success remove the local data; on dismiss remember the choice.
- Demo data button calls the seed/import path instead of writing to localStorage.

**Acceptance criteria**

1. Component tests: banner appears only with local data, import success clears local data and
   refreshes queries, import failure keeps local data and shows an error, replace requires confirmation.

### [ ] FE-06 — UX states, accessibility, responsive, performance

**Branch:** `feat/FE-06-ux-a11y`

**Spec**

- Every page: skeleton/loading state, error state with Retry, empty state with a call to action.
- Toast feedback for every mutation (success + failure).
- Accessibility pass per PRODUCTION_RULES §3.5 (labels, aria-labels on icon buttons such as nav
  emoji icons, focus styles, contrast, heading order).
- Layout verified at 360 px, 768 px, 1280 px; no horizontal scroll.
- Initial JS ≤ 250 KB gzipped (report size in Handoff).

**Acceptance criteria**

1. Component tests for loading, error+retry and empty states on each page.
2. No serious/critical axe violations (axe run in component tests via `vitest-axe` or deferred to FE-07 e2e).
3. Bundle size reported and within budget.

### [ ] FE-07 — End-to-end & accessibility suite in CI

**Branch:** `test/FE-07-e2e`

**Spec**

- Playwright config that starts Postgres (compose/CI service), runs migrations, starts the API and
  the built frontend, and runs in Chromium desktop + a 390×844 mobile viewport.
- Implement all 8 critical journeys from PRODUCTION_RULES §5.3 in `e2e/`.
- `e2e/a11y.spec.ts`: axe on every page, fail on serious/critical.
- Root script `test:e2e`; add an e2e job to CI uploading the Playwright report on failure.

**Acceptance criteria**

1. All journeys pass locally and in CI, 3 consecutive runs without flakes.
2. a11y spec passes on all pages.

---

## 3. Release

### [ ] REL-01 — Production release v1.0.0

**Branch:** `chore/REL-01-release`

**Spec**

- Release Agent runs the complete Production Gate on `main`.
- Update README: architecture overview, local setup (compose, env, migrations, seed), scripts,
  deployment with the Docker image, env var reference.
- `CHANGELOG.md` with v1.0.0 notes; bump versions to `1.0.0`; tag `v1.0.0` and create a GitHub
  release with `gh release create`.

**Acceptance criteria**

1. Every task above is `[x]`; full gate + CI green on `main`; tag and release exist on GitHub.
