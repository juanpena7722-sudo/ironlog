# Testing

## Frontend and shared tests

Vitest runs tests matching `shared/**/*.test.ts` and `src/**/*.test.{ts,tsx}` (configured in
`vite.config.ts`, `test.include`) in the `jsdom` environment.

```bash
npm test               # run once
npm run test:coverage  # run with coverage and thresholds
```

| File                                      | Covers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `shared/schemas.test.ts`                  | Valid and invalid cases for every Zod schema in `shared/schemas.ts`, including each numeric upper limit (valid at the limit, invalid just above) and NUL characters in names, ids and notes, plus the exported constants. `AppDataSchema` accepts `canonicalUnit: 'kg'` and rejects any other value. Auth schemas: email trimmed and lowercased, the readable message for each broken rule, and `UserSchema`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `src/utils.test.ts`                       | Every export of `src/utils.ts` with a fixed system time: `uid` (with and without `crypto.randomUUID`), date helpers, `e1rm`, workout and exercise volume, `round`, `num`, the date sorters and `totals`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `src/store.test.tsx`                      | `normalize()`: empty input, non-array collections replaced, existing collections kept, goals merged over `DEFAULT_GOALS`, `version` always 1.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `src/units.test.ts`                       | 100 lb saves as 45.36 kg and shows as 45.4 kg; kg values stored to 2 decimals and shown to 1; kg to lb for display; inches to cm and back; cm kept; round trip in kg and lb stable to 0.1; a stored kg value drifts less than 0.1 kg through lb.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `src/pages/Dashboard.test.tsx`            | Welcome when there is no data; summary built from API data; weights converted to lb.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `src/pages/Workouts.test.tsx`             | Lists workouts from the API with their PRs; create (`POST`), edit (`PUT /workouts/:id`) and delete; weights shown and entered in lb, stored in kg. Delete announces `Workout deleted.` in `role="status"`. Saving with no named exercise sends nothing and shows `Add at least one exercise with a name.` in `role="alert"`, with `aria-invalid` and `aria-describedby` on the first exercise name until a name is typed; the sets table has an `Actions` column header. The Personal records table is inside a focusable `region` named `Personal records`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `src/pages/Diet.test.tsx`                 | Lists the day's foods and queries the day and the last 14 days; add with calories from macros; quick-add a recent food to the selected meal; delete. Delete uses the `Remove <name>` button and announces `Food removed.` in `role="status"`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `src/pages/Progress.test.tsx`             | Lists check-ins; create; edit the check-in of the same day (`PUT /body/:id`); delete; measurements shown in inches and saved in cm; 100 lb saves as 45.36 kg and shows 45.4 after switching to kg. Delete uses the `Delete <date>` button and announces `Check-in deleted.`; the table has an `Actions` column header.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `src/pages/Health.test.tsx`               | Lists entries and fills the form with the stored day once loaded; create; edit a past day picked from the history; delete. Delete uses the `Delete <date>` button and announces `Day deleted.`; the table has an `Actions` column header.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `src/pages/Auth.test.tsx`                 | Login with the keyboard only (Tab to each field, Enter to submit) redirects to the dashboard and sends the normalised email; validation messages, `aria-invalid`, `aria-describedby` and focus on the first invalid field; server `detail` shown inline (401, 409); `/login` with a session redirects to the dashboard; register redirects to the dashboard; register requires 10 password characters; the links between login and register keep the page to return to.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `src/pages/Settings.test.tsx`             | Targets: shows the saved goals and saves edits; target weight shown in lb and saved in kg; target weight converted when switching units; macro suggestion from the latest bodyweight in kg. Your data: counts; export from `GET /backup` (file keeps `canonicalUnit: 'kg'`); import merges by default, and an API backup from an lb account is sent with `unitHint=kg`; an old browser-only lb export is sent with `unitHint=lb`; replace requires confirmation (alertdialog, focus on Cancel) before `mode=replace` is sent; Cancel sends nothing; an import error shows the server's `detail`; invalid file rejected; demo data after confirmation (`mode=replace&unitHint=kg`); clear all logs keeps the targets; clear all logs is disabled while `GET /goals` fails (500) or is pending, and no import is sent. Delete account: confirmation, password focused, Enter submits `{ password }`, then login is shown and the session is `null`; empty password message; wrong password `detail` inline; Cancel closes the confirmation. A failed demo data import shows the server's `detail` in `role="alert"`. |
| `src/pages/states.test.tsx`               | For each page (Dashboard, Workouts, Diet, Progress, Health, Settings): `Loading…` in `role="status"` while a query is pending, with no empty state; a 500 Problem Details shows `Could not load your data. <detail>` in `role="alert"` with **Retry**, and Retry shows the data; the empty state once the data has loaded. For each page with a form (all but Dashboard): a successful save announces its message in `role="status"`, and a 400 shows the server's `detail` in `role="alert"`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `src/components/LocalDataBanner.test.tsx` | Banner hidden with no local data, local data with no entries, local data that is not JSON, and after a dismissal; shown only when there is local data; import merges in the stored unit (`?mode=merge&unitHint=lb`, normalized body), then removes `ironlog:data`, hides the banner, shows `Local data imported.` in `role="status"` and refetches the goals without fetching the session again; a failed import keeps `ironlog:data` and the banner and shows the server's `detail` in an alert; Dismiss stores `ironlog:local-import-dismissed` and keeps `ironlog:data`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `src/App.test.tsx`                        | Each route shows the `Suspense` fallback, then lazy-loads its page. A 401 from `GET /auth/me` redirects to login, then back to the original page after login. A failed session check shows an error with Retry. Logout shows login, sets the session to `null` and clears every other query from the cache; a failed logout shows its error. Session expiry: a 401 from a data query or a mutation sends the user to login; the next session starts without the previous user's data.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `src/api/client.test.ts`                  | `apiRequest`: successful response parsed with `GoalsSchema`; request sent to `/api/v1/goals` with `same-origin` credentials; Problem Details to `ApiError`; status-text fallback for a non-Problem Details body; malformed response rejected with `ZodError`; a 204 with no body resolves to `undefined`; a body that is not JSON rejects with `SyntaxError`; network failure rejected with `TypeError`. `shouldRetry` with a `QueryClient`: one retry on 503, none on 401, none for a non-`ApiError`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

### Test setup

`src/test/setup.ts` runs before every frontend test file. It:

- starts an MSW server (`msw/node`, `setupServer(...handlers)`) with the default handlers from
  `src/test/handlers.ts` and `onUnhandledRequest: 'error'`, so any real network request fails
  the test;
- after each test, unmounts rendered components (`cleanup`), resets MSW handlers and clears
  `localStorage`;
- stubs `ResizeObserver`, which jsdom lacks and Recharts' `ResponsiveContainer` needs.

`src/test/handlers.ts` exports `GOALS` (a valid `Goals` object), `USER` (a valid `User`) and
`handlers`, which answer `GET /api/v1/goals` with `GOALS`, `GET /api/v1/auth/me` with `USER`
(so tests start logged in), and `GET` on `workouts`, `foods`, `foods/recent`, `body` and
`health-entries` with an empty list. A test that needs a logged-out user overrides `/auth/me` with a 401. `setup.ts` exports `server`; a test overrides a handler with
`server.use(...)`, and the override is reset after the test.

`src/test/mockApi.ts` gives page tests an in-memory API:

| Export                                    | What it does                                                                                                                                                                                                                                                                       |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mockCollection(path, initial, key='id')` | MSW handlers for `GET`, `POST`, `PUT /:key` and `DELETE /:key` under `/api/v1/<path>`, backed by a list. `GET` filters by the `from`/`to` query. `key` is `'date'` for health entries. Returns `requests` (each with `method`, `url` and `body`) and `items()` (the current list). |
| `mockGoals(initial)`                      | `GET` and `PUT /api/v1/goals` backed by one `Goals` value. Returns the list of saved goals.                                                                                                                                                                                        |

`src/test/render.tsx` exports two helpers. Each creates a new `QueryClient` with
`createQueryClient(false)` (query retries off, same session-expiry handler as the app) and
returns it, so a test can inspect the cache.

| Helper                                | Renders                                                        |
| ------------------------------------- | -------------------------------------------------------------- |
| `renderWithProviders(ui, path = '/')` | `ui` inside `QueryClientProvider` and `MemoryRouter` at `path` |
| `renderApp(path)`                     | `App` with the same providers                                  |

Component tests use Testing Library (`@testing-library/react`, `@testing-library/user-event`).

## Coverage

Coverage uses the v8 provider and writes `text` and `html` reports to `coverage/`
(git-ignored). It measures `shared/**/*.ts`, `src/utils.ts`, `src/units.ts` and `src/api/**/*.ts`, excluding test files.

| Scope          | Lines | Branches |
| -------------- | ----- | -------- |
| Overall        | 80 %  | 75 %     |
| `shared/**`    | 90 %  | 85 %     |
| `src/utils.ts` | 90 %  | 85 %     |
| `src/units.ts` | 90 %  | 85 %     |
| `src/api/**`   | 90 %  | 85 %     |

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

| File                          | Covers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `server/src/app.test.ts`      | Health 200; 404, 400 (Zod, with `errors`), 409 (`httpErrors`) and 500 Problem Details; 500 hides internals in production; hardening: helmet headers (CSP, `nosniff`, `X-Frame-Options`, HSTS) and `X-RateLimit-Limit: 300`, redaction of `authorization`, `cookie`, `set-cookie` and passwords in logs, `/docs` 200 in development and 404 in production, 413 Problem Details over the 100 KB body limit.                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `server/src/env.test.ts`      | Valid env with `PORT` default 3000; rejects a `JWT_SECRET` shorter than 32 characters.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `server/src/db.test.ts`       | CRUD for every model; unique lowercase email; one `Goals` per user; exercise and set order by `position`; `Decimal` kg/cm values; one health entry per user per day; cascade delete from `Workout` and from `User`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `server/src/auth.test.ts`     | Register, login, logout, me and account deletion: success paths and cookie flags; 400 invalid input (including a NUL in the email); 401 wrong password, unknown email, non-argon2 hash and missing/expired/tampered/foreign-secret token; Bearer header ignored; 409 duplicate; 403 foreign or `null` Origin; 429 after 10 requests; `/auth/me` and logout stay at 200 and 204 over 15 calls each while login still returns 429 after 10; account deletion removes only that user's rows; password and hash absent from responses and logs.                                                                                                                                                                                                                                                                                              |
| `server/src/workouts.test.ts` | Create, list, get, replace and delete: nested exercises and sets in order, empty optional fields omitted; inclusive `from`/`to` filter newest first; default last 90 days (fixed clock); PUT with fewer exercises removes the dropped ones; delete removes exercises and sets; 400 invalid body, date filter and malformed id; 401 without a session; 404 unknown id; cross-user 404 that leaves the other user's workout unchanged.                                                                                                                                                                                                                                                                                                                                                                                                     |
| `server/src/foods.test.ts`    | Create, list, recent, replace and delete: inclusive `from`/`to` filter newest first; default last 30 days (fixed clock); `recent` de-duplicated case-insensitively, newest first, respects `limit` (default 20) and reads past a batch of 100 duplicates; 400 invalid body (including a NUL in the name), date filter, `limit` and malformed id; 401 without a session; 404 unknown id; cross-user 404 that leaves the other user's entry unchanged.                                                                                                                                                                                                                                                                                                                                                                                     |
| `server/src/body.test.ts`     | Create, list, replace and delete: numeric kg and cm values, empty optional fields omitted; inclusive `from`/`to` filter newest first; default last 90 days (fixed clock); PUT clears dropped fields; 400 invalid body, measurements above 1000 cm, date filter and malformed id; 401 without a session; 404 unknown id; cross-user 404 that leaves the other user's entry unchanged.                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `server/src/health.test.ts`   | Upsert, list and delete: PUT creates an entry and updates the existing one on the same date (same `id`), empty optional fields omitted; inclusive `from`/`to` filter newest first; default last 30 days (fixed clock); 400 invalid body, `steps` above 200000, invalid date and date filter; 401 without a session; 404 no entry for the date; another user's entry on the same date stays separate and unchanged.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `server/src/goals.test.ts`    | GET returns the defaults for a newly registered user and for a user with no goals row; PUT upserts and the update persists (read back with GET); goals kept separate per user; 400 invalid body (with `errors` paths) and partial body; 401 without a session on GET and PUT.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `server/src/backup.test.ts`   | Export as an attachment named with the UTC date (fixed clock) with `canonicalUnit: 'kg'`, empty user with default goals, scoped to the current user; import round trip into a new user; unused UUIDs kept and legacy ids replaced; imported and skipped counts; merge skips duplicates and keeps the goals; merge re-keys ids owned by another user; replace swaps all data without touching other users; replace is atomic (forced failure leaves data unchanged); lb to kg and inches to cm to 2 decimals; shared limits applied after conversion; deeply nested unknown fields with `unitHint=lb` (200); no conversion with `unitHint=kg`; 409 when another user takes an id during the import (deterministic, via a spied `findMany`); 400 invalid file, `mode` and `unitHint`; 413 over 5 MB; 401 without a session on both routes. |

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

## End-to-end tests

Playwright (`@playwright/test`) drives Chromium through the production stack: gateway, API and
PostgreSQL from `docker-compose.prod.yml`. `@axe-core/playwright` runs the accessibility scans.
The config is `playwright.config.ts`; the tests are in `e2e/` and are type-checked with
`tsconfig.e2e.json` (part of `npm run typecheck`).

### Prerequisites

- Docker with Compose v2, and nothing else listening on ports 80 and 443.
- The Chromium browser for Playwright, installed once after `npm ci`:

```bash
npx playwright install chromium   # add --with-deps on a fresh Linux machine
```

No `.env` is needed.

### Run

```bash
npm run test:e2e
```

The report is written to `playwright-report/` and the failure traces to `test-results/` (both
git-ignored). Open the report with `npx playwright show-report`.

### Stack lifecycle

`e2e/global-setup.ts` runs once before the tests:

1. Generates a random `POSTGRES_PASSWORD` and `JWT_SECRET` for this run. They exist only in the
   environment of the commands below; nothing is written to disk.
2. Runs `npm run build`, because the gateway serves `./dist`.
3. Runs `docker compose -f docker-compose.prod.yml up -d --build` with `SITE_ADDRESS=:80`.
4. Waits up to 120 seconds for `http://localhost/api/v1/health` to return 200.

After the tests, the teardown it returns runs `docker compose -f docker-compose.prod.yml down -v`,
which removes the containers and the `db-data` and `caddy-data` volumes. If any setup step
fails, the same teardown runs before the error is reported. Every run starts with an empty
database. The development `postgres` service is a different Compose project and is not touched.

### Projects

| Project   | Browser                            | Runs                             |
| --------- | ---------------------------------- | -------------------------------- |
| `setup`   | Chromium                           | `e2e/auth.setup.ts`              |
| `desktop` | Chromium (`Desktop Chrome`)        | Every `*.spec.ts`, after `setup` |
| `mobile`  | Chromium with a 390 × 844 viewport | Every `*.spec.ts`, after `setup` |

`baseURL` is `http://localhost`. Tests run one at a time (`workers: 1`) with no retries, and
`forbidOnly` is on in CI. Traces are kept only for failed tests.

| Spec                   | Journey                                                                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `e2e/auth.spec.ts`     | Register, log out, log in again and land on the dashboard.                                                                                                         |
| `e2e/logout.spec.ts`   | After **Log out**, each protected page redirects to `/login`.                                                                                                      |
| `e2e/workout.spec.ts`  | Log a workout (100 kg × 5) and see the personal record (116.7 kg) and the history entry.                                                                           |
| `e2e/diet.spec.ts`     | Add foods, one with calories calculated from its macros, and see the daily targets and the food log update.                                                        |
| `e2e/progress.spec.ts` | Add two weigh-ins and see the current weight and the trend chart with two points.                                                                                  |
| `e2e/health.spec.ts`   | Save a day of sleep, water, resting HR, steps, energy and notes, and see it in the stats and the history.                                                          |
| `e2e/units.spec.ts`    | Switch to lb, save 100 lb (stored as 45.36 kg by the API), switch back to kg and see 45.4 kg.                                                                      |
| `e2e/backup.spec.ts`   | Export a backup, clear all logs, import it in replace mode and get the same counts; import lb data left by the browser-only version through the local-data banner. |
| `e2e/a11y.spec.ts`     | axe on `/login` and `/register` signed out, and on the six app pages with demo data; fails on any serious or critical violation.                                   |

### Shared user and rate limits

`e2e/auth.setup.ts` registers one user and saves its session to `test-results/.auth/user.json`.
`desktop` and `mobile` start every test signed in as that user, and the specs that need a
signed-out browser use an empty storage state (`SIGNED_OUT` in `e2e/helpers.ts`). Tests that
change data first call `resetData()`, which imports an empty backup with the default goals in
`replace` mode, so each test starts from the same state. This shared state is why tests run one
at a time.

All requests come from one IP, and the server limits are not relaxed for the tests (300 requests
per minute, 10 per minute on register and login; see
[`backend.md`](./backend.md#rate-limit)). A run registers 3 users and logs in twice, under the
auth limit. Before each test, `waitForRateLimit()` in `e2e/helpers.ts` calls `GET /api/v1/health`
and reads `x-ratelimit-remaining`; if fewer than 60 requests are left in the window, it waits
for `x-ratelimit-reset` and extends the test timeout by the same time. A full run takes about 1.5
minutes.

### CI

The `e2e` job in `.github/workflows/ci.yml` runs after the `frontend` and `backend` jobs pass. It
runs `npm ci`, `npx playwright install --with-deps chromium` and `npm run test:e2e`, with the same
generated secrets; it uses no repository secrets.

When the job fails, it uploads the artifact `playwright-report` (kept 7 days) with
`playwright-report/` and `test-results/`, without `test-results/.auth/`, which holds the session
cookie. To read it, download it from the run's summary page, unzip it, and open the report:

```bash
npx playwright show-report playwright-report
```

Each failed test shows its error and its trace (the actions, network requests and DOM snapshots). A trace can also be
opened on its own with `npx playwright show-trace test-results/<test>/trace.zip`.

_Last updated by TF07._
