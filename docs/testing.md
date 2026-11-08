# Testing

## Unit tests

Vitest runs tests matching `shared/**/*.test.ts` and `src/**/*.test.{ts,tsx}` (configured in
`vite.config.ts`, `test.include`).

```bash
npm test               # run once
npm run test:coverage  # run with coverage and thresholds
```

| File                     | Covers                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------- |
| `shared/schemas.test.ts` | Valid and invalid cases for every Zod schema in `shared/schemas.ts`, plus the exported constants. |

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

| File                      | Covers                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `server/src/app.test.ts`  | Health 200; 404, 400 (Zod, with `errors`), 409 (`httpErrors`) and 500 Problem Details; 500 hides internals in production.                                                                                                                                                                                                                                                                               |
| `server/src/env.test.ts`  | Valid env with `PORT` default 3000; rejects a `JWT_SECRET` shorter than 32 characters.                                                                                                                                                                                                                                                                                                                  |
| `server/src/db.test.ts`   | CRUD for every model; unique lowercase email; one `Goals` per user; exercise and set order by `position`; `Decimal` kg/cm values; one health entry per user per day; cascade delete from `Workout` and from `User`.                                                                                                                                                                                     |
| `server/src/auth.test.ts` | Register, login, logout, me and account deletion: success paths and cookie flags; 400 invalid input; 401 wrong password, unknown email, non-argon2 hash and missing/expired/tampered/foreign-secret token; Bearer header ignored; 409 duplicate; 403 foreign or `null` Origin; 429 after 10 requests; account deletion removes only that user's rows; password and hash absent from responses and logs. |

### Test database

`server/src/test/db.ts` exports:

| Export               | Use                                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| `TEST_ENV`           | An `Env` with `NODE_ENV=test` and `DATABASE_URL` pointing at `ironlog_test`. Pass it to `buildApp()`. |
| `truncateTables(db)` | Runs `TRUNCATE TABLE "User" CASCADE`, which empties every table.                                      |

`auth.test.ts` truncates before each test and sends a fixed `host` header so the Origin check
has a known host. It captures logs by passing a stream to `buildApp(TEST_ENV, { write })`, and
fakes only `Date` (`vi.useFakeTimers({ toFake: ['Date'] })`) to expire a token.

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

_Last updated by TB03._
