# Changelog

## TF07 — End-to-end and accessibility suite in CI (2026-11-11)

- Added: Playwright suite in `e2e/` (`npm run test:e2e`) against the production stack from
  `docker-compose.prod.yml`, in two Chromium projects: `desktop` and `mobile` (390 × 844). It
  covers every critical journey: register and log in, logout redirect, workout and PR, foods and
  macros, weigh-ins and chart, health entry, kg ↔ lb, backup export and import, and the
  local-data import.
- Added: `e2e/a11y.spec.ts` runs axe (`@axe-core/playwright`) on `/login`, `/register` and the six
  app pages with demo data, and fails on serious or critical violations.
- Added: `e2e/global-setup.ts` builds `dist/`, starts the stack with secrets generated for the
  run, waits for `/api/v1/health` and removes the stack and its volumes (`down -v`) afterwards.
- Added: CI job `e2e` after `frontend` and `backend`; on failure it uploads `playwright-report/`
  and `test-results/` (without `test-results/.auth/`) for 7 days.
- Added: dev dependencies `@playwright/test` and `@axe-core/playwright`; `tsconfig.e2e.json` in
  the `typecheck` build; ESLint ignores `playwright-report` and `test-results`.
- Fixed: the Workouts Personal records table was not reachable by keyboard when it scrolled on
  narrow screens (axe `scrollable-region-focusable`, serious). Its wrapper is now a focusable
  region named `Personal records`.

## TF06 — UX states, accessibility, performance (2026-11-11)

- Added: `QueryState` and `MutationFeedback` in `src/components/ui.tsx`. Every page shows
  loading (`role="status"`), an error with **Retry** (`role="alert"`, the server's `detail`) and,
  only after the data has loaded, its empty state. Every save and delete reports its result.
- Added: accessible names on the nav links, **Log out**, the icon-only ✕ buttons and the
  unlabelled inputs; `aria-expanded` on workout history rows; a `:focus-visible` outline; a
  `.sr-only` class for the `Actions` table headers; links inside paragraphs are underlined.
- Added: Workouts **Save workout** with no named exercise shows `Add at least one exercise with a
name.` with `aria-invalid` on the first exercise name.
- Changed: `--danger` is `#f87171`; new `--danger-strong` (`#dc2626`) for solid danger buttons.
- Changed: the Dashboard chart is the lazy-loaded `WeightTrendChart`, so Recharts is not in the
  first load (122.3 KB gzipped on `/login`, 124.2 KB on the Dashboard).
- Changed: Settings shows successes in `role="status"` and errors in `role="alert"`; errors from
  save targets, clear all logs and demo data are now shown. `LocalDataBanner` shows `Local data
imported.`
- Fixed: many quick reloads showed `Could not check your session.`: `GET /auth/me` and
  `POST /auth/logout` now use only the global 300/min limit (register, login and account
  deletion keep 10/min), and `useImportData()` no longer refetches the session.

## TF05 — Backup and local-data migration (2026-11-11)

- Added: **Import mode** in Settings: backups import with `POST /backup/import` in `merge`
  (default) or `replace` mode; replace asks for confirmation first. Import errors show the
  server's `detail`.
- Added: `LocalDataBanner`: after sign-in, data in `localStorage['ironlog:data']` from the
  browser-only version can be imported once (`mode=merge`, `unitHint` = its stored unit). Success
  removes the key; **Dismiss** is remembered in `ironlog:local-import-dismissed`.
- Added: optional `canonicalUnit: 'kg'` in `AppDataSchema`; `GET /backup` sets it. `unitHintFor()`
  sends `unitHint=kg` for marked files and the file's `goals.unit` for old unmarked ones, so an
  export from an lb account is not converted twice.
- Changed: `useReplaceData()` is replaced by `useImportData({ data, mode, unitHint })`. The
  Settings confirmation box is a `role="alertdialog"` with focus on **Cancel**.

## TF04 — Data layer on the API (kg canonical) (2026-11-11)

- Changed: `src/store.tsx` reads and writes through the API with TanStack Query hooks
  (`useWorkouts`, `useFoods`, `useRecentFoods`, `useBody`, `useHealth`, `useGoals`) and
  mutations; `StoreProvider`, `useStore` and `localStorage` persistence are removed.
- Added: `src/units.ts` (`toDisplayWeight`, `fromDisplayWeight`, `toDisplayLength`,
  `fromDisplayLength`). Data is stored in kg and cm and shown in the user's unit, `Goals.unit`,
  which is stored by the API.
- Added: `createQueryClient` in `src/api/auth.ts`: a 401 from any data query or mutation ends the
  session and clears the cached data.
- Changed: Settings export uses `GET /backup`; import, demo data and **Clear all logs** use
  `POST /backup/import?mode=replace`. **Clear all logs** keeps the saved goals and is disabled
  until they load.
- Fixed: the Vite dev proxy kept `changeOrigin` on, so the API rejected every `POST` from
  `npm run dev` with 403; it now keeps the browser's `Host` header.
- Added: `src/test/mockApi.ts` (`mockCollection`, `mockGoals`), page tests for list, create, edit
  and delete, `src/units.test.ts` and session-expiry tests; coverage includes `src/units.ts`.

## TF03 — Auth screens and protected routes (2026-11-11)

- Added: `/login` and `/register` pages (`src/pages/Auth.tsx`) validated with the shared schemas,
  with the server's `detail` shown inline.
- Added: `src/api/auth.ts` with `useSession` (`GET /auth/me`, `null` on 401), `useSignIn`,
  `useLogout`, `useDeleteAccount` and `errorMessage`.
- Added: `ProtectedShell` in `src/App.tsx`: without a session every page redirects to `/login`
  and returns to the original page after sign-in; **Log out** in the navigation.
- Added: **Account** card in Settings to delete the account after confirmation and the password.
  Logout and account deletion clear the query cache and the session.
- Added: `Field` component in `src/components/ui.tsx`; `src/test/render.tsx` helpers; default
  MSW handler for `GET /api/v1/auth/me`.
- Changed: `LoginSchema`, `RegisterSchema`, `DeleteAccountSchema` and `UserSchema` live in
  `shared/schemas.ts` and `server/src/auth.ts` uses them; the auth 400 `errors` messages are now
  readable text. Field rules are unchanged.
- Changed: `apiRequest` accepts empty (204) responses.

## TF02 — API client and TanStack Query (2026-11-11)

- Added: dependency `@tanstack/react-query` (v5); `src/main.tsx` wraps the app in
  `QueryClientProvider`, with queries retried once on 5xx only (`shouldRetry`).
- Added: `src/api/client.ts` with `apiRequest` (fixed same-origin base `/api/v1`,
  `credentials: 'same-origin'`, responses validated with shared Zod schemas) and `ApiError`
  (`status`, `title`, `detail`) parsed from Problem Details.
- Added: Vite dev proxy from `/api` to `http://localhost:3000`.
- Added: `src/test/handlers.ts` (default MSW handlers) and `src/api/client.test.ts`.
- Changed: `src/test/setup.ts` loads the default handlers and exports `server`; coverage also
  measures `src/api/**` (90 % lines / 85 % branches).
- Added: `docs/frontend.md`.

## TF01 — Frontend test harness and existing-logic tests (2026-11-11)

- Added: dev dependencies `@testing-library/react`, `@testing-library/dom`,
  `@testing-library/user-event`, `jsdom` and `msw` (v2).
- Added: `src/test/setup.ts` (MSW server that rejects unhandled requests, cleanup,
  `localStorage` reset, `ResizeObserver` stub); frontend tests run in `jsdom`.
- Added: unit tests for every export of `src/utils.ts` and for `normalize()`, a smoke test per
  page and a lazy-loading test for every route.
- Changed: `src/App.tsx` lazy-loads the six route pages with `React.lazy` and `Suspense`; each
  page builds as its own chunk.
- Changed: coverage now measures `src/utils.ts` (90 % lines / 85 % branches); `normalize` is
  exported from `src/store.tsx`.

## TB09 — Hardening, gateway and production stack (2026-11-11)

- Added: `@fastify/helmet` (default CSP), a global rate limit of 300 requests per minute per IP,
  a 100 KB body limit (backup import keeps 5 MB) and graceful shutdown on `SIGINT` / `SIGTERM`.
- Added: `GET /docs` returns the OpenAPI JSON document (`@fastify/swagger`) outside production;
  404 in production.
- Added: `server/Dockerfile` (multi-stage, `node:26-alpine`, non-root, runs
  `prisma migrate deploy` on start), `deploy/Caddyfile` (serves `dist/`, proxies `/api/v1/*` to
  `api:3000`, SPA fallback, security headers) and `docker-compose.prod.yml` (only the gateway
  publishes ports; `api` and `db` on an internal network).
- Added: root `.dockerignore` and the production stack variables (`POSTGRES_PASSWORD`,
  `JWT_SECRET`, `SITE_ADDRESS`) in the root `.env.example`.
- Changed: in production the API listens on `0.0.0.0` and trusts `X-Forwarded-For`
  (`trustProxy`); elsewhere it still listens on `127.0.0.1`.
- Changed: `prisma` moved from dev dependencies to dependencies (runtime migrations).
- Security: log redaction now covers `authorization`, `cookie` and `set-cookie` under any
  `headers` object (`*.headers.*`), not only `req.headers` / `res.headers`.

## TB08 — Backup export/import API (2026-11-08)

- Added: `GET /api/v1/backup` (all of the user's data as an `AppData` v1 attachment
  `ironlog-backup-YYYY-MM-DD.json`) and `POST /api/v1/backup/import?mode=merge|replace&unitHint=kg|lb`
  (5 MB limit, one transaction, returns `{ imported, skipped }` counts) in `server/src/backup.ts`.
- Added: `unitHint=lb` converts weights to kg and inches to cm, rounded to 2 decimals, before
  validation.
- Added: 409 `Import conflicted with concurrent changes; retry` when another request takes an
  imported id during the import.
- Changed: the row mappers in `workouts.ts`, `foods.ts`, `body.ts`, `health.ts` and `goals.ts`
  are exported for reuse; the health PUT field mapping moved into `toHealthData()`.
- Fixed: a NUL character in an id, name, note, email or password returns 400 instead of 500
  (`textSchema` in `shared/schemas.ts`).
- Security: both routes require a session and are scoped by `userId`; imported ids owned by
  another user are replaced, never reused.

## TB07 — Goals API (2026-11-08)

- Added: `GET /api/v1/goals` (the stored goals, or the defaults when none are stored) and
  `PUT /api/v1/goals` (full `Goals` body validated with `GoalsSchema`, upsert, always 200) in
  `server/src/goals.ts`.
- Changed: `DEFAULT_GOALS` is exported from `server/src/auth.ts` and reused by the goals routes.
- Security: both routes require a session and are scoped by `userId`.

## TB06 — Body and health API (2026-11-08)

- Added: `GET /api/v1/body` (`from` / `to` filter, default last 90 days, newest first),
  `POST /api/v1/body`, `PUT /api/v1/body/:id` and `DELETE /api/v1/body/:id` in
  `server/src/body.ts`.
- Added: `GET /api/v1/health-entries` (`from` / `to` filter, default last 30 days, newest first),
  `PUT /api/v1/health-entries/:date` (upsert, always 200) and
  `DELETE /api/v1/health-entries/:date` in `server/src/health.ts`.
- Changed: `shared/schemas.ts` caps numbers that had no upper limit: body `chest`, `waist`,
  `arms`, `thighs` ≤ 1000 cm; health `steps` ≤ 200000, `restingHR` ≤ 300, `waterL` ≤ 20; food
  and goals `calories` ≤ 20000, `protein` / `carbs` / `fat` ≤ 2000; goals `waterL` ≤ 20.
- Fixed: oversized numbers (for example `steps: 3000000000`) return 400 instead of 500.
- Security: every route requires a session and is scoped by `userId`; another user's entry
  returns 404.

## TB05 — Food log API (2026-11-08)

- Added: `GET /api/v1/foods` (`from` / `to` filter, default last 30 days, newest first),
  `GET /api/v1/foods/recent` (`limit` 1–50, default 20; one entry per name, case-insensitive,
  newest first), `POST /api/v1/foods`, `PUT /api/v1/foods/:id` and `DELETE /api/v1/foods/:id` in
  `server/src/foods.ts`.
- Added: bodies validated with the shared `FoodEntrySchema` (`meal` one of `MEALS`); ids
  generated by the server.
- Changed: `ID_PARAMS_SCHEMA`, `parseDateRange()` and `toISODate()` moved from
  `server/src/workouts.ts` to the new `server/src/routes.ts`; workouts behaviour unchanged.
- Security: every route requires a session and is scoped by `userId`; another user's entry
  returns 404.

## TB04 — Workouts API (2026-11-08)

- Added: `GET /api/v1/workouts` (`from` / `to` filter, default last 90 days, newest first),
  `GET /api/v1/workouts/:id`, `POST /api/v1/workouts`, `PUT /api/v1/workouts/:id` and
  `DELETE /api/v1/workouts/:id` in `server/src/workouts.ts`.
- Added: bodies validated with the shared `WorkoutSchema`; ids generated by the server; responses
  match the shared `Workout` shape with exercise and set order kept.
- Added: PUT replaces the workout and all of its exercises and sets in one transaction.
- Changed: `server/tsconfig.json` maps `zod` to the server's copy so `tsc` resolves it from
  `shared/` when only the server dependencies are installed.
- Security: every route requires a session and is scoped by `userId`; another user's workout
  returns 404.

## TB03 — Authentication (2026-11-08)

- Added: `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`,
  `GET /api/v1/auth/me` and `DELETE /api/v1/auth/account` in `server/src/auth.ts`.
- Added: register creates the default goals; account deletion removes the user and all of their
  data.
- Added: `app.requireAuth` preHandler that sets `request.userId` from the session and returns
  401 if the user no longer exists.
- Added: dependencies `@fastify/cookie`, `@fastify/jwt`, `@fastify/rate-limit` and `argon2`
  (`^0.41.1`, see the glibc note in `setup.md`).
- Changed: `buildApp(env, logStream?)` accepts an optional log stream so tests can read logs.
- Security: argon2id password hashes; HS256 JWT session (7 days) in an `HttpOnly`, `Secure`,
  `SameSite=Strict` cookie on `/api/v1`; Bearer headers ignored.
- Security: login returns one generic 401 for any wrong credential, with a dummy hash check
  for unknown emails.
- Security: 403 for state-changing requests with a foreign or `null` `Origin`; auth routes limited
  to 10 requests/min per IP (429).
- Security: logs redact `authorization`, `cookie`, `set-cookie` and `password`.

## TB02 — Database schema and migrations (2026-11-08)

- Added: Prisma 7 with `@prisma/adapter-pg`; models `User`, `Goals`, `Workout`, `Exercise`,
  `WorkoutSet`, `FoodEntry`, `BodyEntry`, `HealthEntry` in `server/prisma/schema.prisma`, and
  the committed `init` migration.
- Added: weights in kg and lengths in cm as `Decimal(6,2)`; calendar days as `date`; `position`
  ordering for exercises and sets; `(userId, date)` indexes; `HealthEntry` unique on
  `(userId, date)`; cascade deletes from `User` and `Workout`.
- Added: `app.db` (Prisma client from `createDb()` in `server/src/db.ts`), disconnected on
  `app.close()`.
- Added: server scripts `postinstall` (`prisma generate`), `db:migrate`, `db:migrate:test`,
  `db:reset:test`, `db:seed` (demo user from `src/demo.ts`).
- Added: `server/src/test/db.ts` (`TEST_ENV`, `truncateTables()`) and `server/src/db.test.ts`.
- Changed: server tests run one file at a time (`fileParallelism: false`); the CI `backend` job
  runs `db:migrate:test` before the tests.
- Security: emails must be lowercase (`CHECK` constraint); all queries go through Prisma
  parameterised queries.

## TB01 — Server scaffold (2026-11-08)

- Added: `server/` package (Fastify 5, ESM, Node.js 26, strict TypeScript) with ESLint, Vitest,
  tsx and tsup; scripts `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:coverage`.
- Added: `server/src/env.ts`, which validates `NODE_ENV`, `PORT` (default 3000), `DATABASE_URL`
  and `JWT_SECRET` (at least 32 characters) with Zod. Invalid env stops startup.
- Added: `buildApp()` in `server/src/app.ts` with `@fastify/sensible` and a global error handler
  that returns RFC 9457 Problem Details (400 with `errors`, 404, 4xx `httpErrors`, 500).
- Added: `GET /api/v1/health` returns `{ "status": "ok" }`.
- Added: `docker-compose.yml` with `postgres:16` (`ironlog_dev`, plus `ironlog_test` via
  `server/db/init.sql`); `server/.env.example`.
- Added: `backend` CI job with a PostgreSQL service.
- Changed: root `eslint.config.js` ignores `server/`, which has its own ESLint config.
- Security: the server listens on `127.0.0.1` only; 500 responses hide internal messages
  outside `development`; Postgres is published on `127.0.0.1` only.

## TF00 — Foundation: tooling, shared schemas, CI (2026-11-08)

- Added: Prettier and `eslint-config-prettier`; scripts `format`, `format:check`, `typecheck`,
  `test`, `test:coverage`.
- Added: Vitest with v8 coverage and thresholds (80/75 overall, 90/85 for `shared/**`).
- Added: `shared/schemas.ts` with Zod schemas for every data type, and `shared/schemas.test.ts`.
- Added: `@shared/*` alias in Vite and TypeScript.
- Added: GitHub Actions workflow `.github/workflows/ci.yml`.
- Added: `.env.example`; `.gitignore` entries for `.env`, `coverage`, `playwright-report`,
  `test-results`.
- Changed: `src/types.ts` re-exports the types inferred from `shared/schemas.ts`.
- Changed: all existing files reformatted with Prettier (no behaviour change).
- Removed: comments that restated the code, scaffold comments, unused exports.
- Security: `react-router-dom` bumped to `^6.30.6` to clear a high-severity advisory.
