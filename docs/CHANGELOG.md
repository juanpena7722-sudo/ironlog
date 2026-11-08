# Changelog

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
