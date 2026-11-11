# Testing

## Unit tests

Vitest runs tests matching `shared/**/*.test.ts` and `src/**/*.test.{ts,tsx}` (configured in
`vite.config.ts`, `test.include`).

```bash
npm test               # run once
npm run test:coverage  # run with coverage and thresholds
```

| File                     | Covers                                                                                                                                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shared/schemas.test.ts` | Valid and invalid cases for every Zod schema in `shared/schemas.ts`, including each numeric upper limit (valid at the limit, invalid just above) and NUL characters in names, ids and notes, plus the exported constants. |

## Coverage

Coverage uses the v8 provider and writes `text` and `html` reports to `coverage/`
(git-ignored).

| Scope       | Lines | Branches |
| ----------- | ----- | -------- |
| Overall     | 80 %  | 75 %     |
| `shared/**` | 90 %  | 85 %     |

Only `shared/**/*.ts` (excluding test files) is measured for now. `src/` is not yet included in
coverage.

## Backend tests

The server has its own Vitest config, `server/vitest.config.ts`, which runs `server/src/**/*.test.ts`.
API tests call `buildApp()` and send requests with `app.inject()`; no port is opened.

The tests use the real PostgreSQL database `ironlog_test`. Start it and apply the migrations
first:

```bash
docker compose up -d postgres
npm --prefix server run db:migrate:test
npm --prefix server test               # run once
npm --prefix server run test:coverage  # run with coverage and thresholds
```

| File                          | Covers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `server/src/app.test.ts`      | Health 200; 404, 400 (Zod, with `errors`), 409 (`httpErrors`) and 500 Problem Details; 500 hides internals in production; hardening: helmet headers (CSP, `nosniff`, `X-Frame-Options`, HSTS) and `X-RateLimit-Limit: 300`, redaction of `authorization`, `cookie`, `set-cookie` and passwords in logs, `/docs` 200 in development and 404 in production, 413 Problem Details over the 100 KB body limit.                                                                                                                                                                                                                                                                                                                                                                                                     |
| `server/src/env.test.ts`      | Valid env with `PORT` default 3000; rejects a `JWT_SECRET` shorter than 32 characters.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `server/src/db.test.ts`       | CRUD for every model; unique lowercase email; one `Goals` per user; exercise and set order by `position`; `Decimal` kg/cm values; one health entry per user per day; cascade delete from `Workout` and from `User`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `server/src/auth.test.ts`     | Register, login, logout, me and account deletion: success paths and cookie flags; 400 invalid input (including a NUL in the email); 401 wrong password, unknown email, non-argon2 hash and missing/expired/tampered/foreign-secret token; Bearer header ignored; 409 duplicate; 403 foreign or `null` Origin; 429 after 10 requests; account deletion removes only that user's rows; password and hash absent from responses and logs.                                                                                                                                                                                                                                                                                                                                                                        |
| `server/src/workouts.test.ts` | Create, list, get, replace and delete: nested exercises and sets in order, empty optional fields omitted; inclusive `from`/`to` filter newest first; default last 90 days (fixed clock); PUT with fewer exercises removes the dropped ones; delete removes exercises and sets; 400 invalid body, date filter and malformed id; 401 without a session; 404 unknown id; cross-user 404 that leaves the other user's workout unchanged.                                                                                                                                                                                                                                                                                                                                                                          |
| `server/src/foods.test.ts`    | Create, list, recent, replace and delete: inclusive `from`/`to` filter newest first; default last 30 days (fixed clock); `recent` de-duplicated case-insensitively, newest first, respects `limit` (default 20) and reads past a batch of 100 duplicates; 400 invalid body (including a NUL in the name), date filter, `limit` and malformed id; 401 without a session; 404 unknown id; cross-user 404 that leaves the other user's entry unchanged.                                                                                                                                                                                                                                                                                                                                                          |
| `server/src/body.test.ts`     | Create, list, replace and delete: numeric kg and cm values, empty optional fields omitted; inclusive `from`/`to` filter newest first; default last 90 days (fixed clock); PUT clears dropped fields; 400 invalid body, measurements above 1000 cm, date filter and malformed id; 401 without a session; 404 unknown id; cross-user 404 that leaves the other user's entry unchanged.                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `server/src/health.test.ts`   | Upsert, list and delete: PUT creates an entry and updates the existing one on the same date (same `id`), empty optional fields omitted; inclusive `from`/`to` filter newest first; default last 30 days (fixed clock); 400 invalid body, `steps` above 200000, invalid date and date filter; 401 without a session; 404 no entry for the date; another user's entry on the same date stays separate and unchanged.                                                                                                                                                                                                                                                                                                                                                                                            |
| `server/src/goals.test.ts`    | GET returns the defaults for a newly registered user and for a user with no goals row; PUT upserts and the update persists (read back with GET); goals kept separate per user; 400 invalid body (with `errors` paths) and partial body; 401 without a session on GET and PUT.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `server/src/backup.test.ts`   | Export as an attachment named with the UTC date (fixed clock), empty user with default goals, scoped to the current user; import round trip into a new user; unused UUIDs kept and legacy ids replaced; imported and skipped counts; merge skips duplicates and keeps the goals; merge re-keys ids owned by another user; replace swaps all data without touching other users; replace is atomic (forced failure leaves data unchanged); lb to kg and inches to cm to 2 decimals; shared limits applied after conversion; deeply nested unknown fields with `unitHint=lb` (200); no conversion with `unitHint=kg`; 409 when another user takes an id during the import (deterministic, via a spied `findMany`); 400 invalid file, `mode` and `unitHint`; 413 over 5 MB; 401 without a session on both routes. |

### Test database

`server/src/test/db.ts` exports:

| Export               | Use                                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| `TEST_ENV`           | An `Env` with `NODE_ENV=test` and `DATABASE_URL` pointing at `ironlog_test`. Pass it to `buildApp()`. |
| `truncateTables(db)` | Runs `TRUNCATE TABLE "User" CASCADE`, which empties every table.                                      |

`auth.test.ts` truncates before each test and sends a fixed `host` header so the Origin check
has a known host. It captures logs by passing a stream to `buildApp(TEST_ENV, { write })`, and
fakes only `Date` (`vi.useFakeTimers({ toFake: ['Date'] })`) to expire a token.
`workouts.test.ts` truncates before each test, signs sessions with `app.jwt.sign()` and fakes
only `Date` the same way to test the default 90-day range. `foods.test.ts` does the same for the
default 30-day range, and seeds `FoodEntry` rows with fixed `createdAt` values for `recent`.
`body.test.ts` and `health.test.ts` do the same for their default 90-day and 30-day ranges.
`goals.test.ts` truncates before each test and signs sessions with `app.jwt.sign()`; one test
registers through `/api/v1/auth/register` to check a new user's defaults. `backup.test.ts`
truncates before each test, signs sessions with `app.jwt.sign()`, fakes only `Date` for the
filename, and wraps `app.db.$transaction` with `vi.spyOn` to force a failure (atomic replace)
and a concurrent id conflict (409).

A test file that uses the database calls `truncateTables(app.db)` before its tests and
`app.close()` after them, which disconnects the client. `db.test.ts` also truncates before each
test.
`server/vitest.config.ts` sets `fileParallelism: false`, so test files run one at a time and do
not truncate each other's data.

If the schema in `ironlog_test` is out of date or broken, the owner runs
`npm --prefix server run db:reset:test` (see [`setup.md`](./setup.md#database-scripts)).

Coverage measures `server/src/**/*.ts` except test files, `src/server.ts` (the entry point) and
the generated Prisma client (`src/generated/**`),
with thresholds of 90 % lines and 85 % branches. Reports go to `server/coverage/` (git-ignored).

_Last updated by TB09._
