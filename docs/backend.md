# Backend

## Package

The API lives in `server/`, a separate npm package (`ironlog-server`) with its own
`package.json`, lockfile, ESLint config (`server/eslint.config.js`) and `tsconfig.json`. It is
ESM, runs on Node.js 26 and uses Fastify 5 with TypeScript `strict`. The root ESLint config
ignores `server/`; root Prettier formats it.

### Shared schemas

The server uses the Zod schemas in `shared/schemas.ts` (the same ones the frontend uses) through a
relative import, for example `import { WorkoutSchema } from '../../shared/schemas.js'`. There is
no path alias in `server/`.

`shared/` has no `node_modules` of its own, and CI's backend job installs only the server
dependencies (`npm ci` in `server/`). So that `tsc` can resolve `zod` for `shared/schemas.ts` in
that case, `server/tsconfig.json` maps it to the server's copy:

```json
"paths": { "zod": ["./node_modules/zod/index.d.ts"] }
```

Vitest and tsup resolve `zod` at run and build time without extra configuration. tsup bundles
`shared/schemas.ts` into `server/dist/server.js` and keeps `zod` as an external import.

## Modules

| File                     | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `server/src/env.ts`      | `parseEnv(source)` validates environment variables with Zod and returns a typed `Env`. It throws on invalid input.                                                                                                                                                                                                                                                                                                             |
| `server/src/app.ts`      | `buildApp(env, logStream?)` creates the Fastify instance: configures the logger, registers `@fastify/sensible`, decorates `app.db`, adds the 404 and global error handlers, calls `registerAuth()`, adds the health route and registers `workoutRoutes` under `/api/v1/workouts`, `foodRoutes` under `/api/v1/foods`, `bodyRoutes` under `/api/v1/body` and `healthRoutes` under `/api/v1/health-entries`. It does not listen. |
| `server/src/auth.ts`     | `registerAuth(app, env)` registers cookies, JWT, the auth rate limit, `app.requireAuth`, the Origin check and the `/api/v1/auth` routes (see [Authentication](#authentication)).                                                                                                                                                                                                                                               |
| `server/src/workouts.ts` | `workoutRoutes` plugin: the 5 `/api/v1/workouts` routes (see [Workouts](#workouts)).                                                                                                                                                                                                                                                                                                                                           |
| `server/src/foods.ts`    | `foodRoutes` plugin: the 5 `/api/v1/foods` routes (see [Foods](#foods)).                                                                                                                                                                                                                                                                                                                                                       |
| `server/src/body.ts`     | `bodyRoutes` plugin: the 4 `/api/v1/body` routes (see [Body](#body)).                                                                                                                                                                                                                                                                                                                                                          |
| `server/src/health.ts`   | `healthRoutes` plugin: the 3 `/api/v1/health-entries` routes (see [Health entries](#health-entries)).                                                                                                                                                                                                                                                                                                                          |
| `server/src/goals.ts`    | `goalsRoutes` plugin: the 2 `/api/v1/goals` routes (see [Goals](#goals)).                                                                                                                                                                                                                                                                                                                                                      |
| `server/src/routes.ts`   | Helpers shared by the resource plugins: `ID_PARAMS_SCHEMA` (`:id` must be a UUID), `parseDateRange(query, defaultDays)` (validates `from` / `to` and returns the Prisma `date` filter) and `toISODate(date)` (`Date` to `yyyy-mm-dd`).                                                                                                                                                                                         |
| `server/src/db.ts`       | `createDb(databaseUrl)` returns a `PrismaClient` that uses the `@prisma/adapter-pg` driver adapter. It also declares the `app.db` type on `FastifyInstance`.                                                                                                                                                                                                                                                                   |
| `server/src/server.ts`   | Entry point. Parses `process.env`, builds the app and listens on `127.0.0.1:<PORT>`.                                                                                                                                                                                                                                                                                                                                           |
| `server/src/test/db.ts`  | Test helpers: `TEST_ENV` (an `Env` pointing at `ironlog_test`) and `truncateTables(db)`.                                                                                                                                                                                                                                                                                                                                       |

Tests call `buildApp()` and use `app.inject()`, so no port is opened.

The server binds to `127.0.0.1` only. It is never exposed publicly; browser traffic reaches it
through the gateway (PRODUCTION_RULES §3.4).

Logging uses Fastify's built-in pino logger at level `info`. When `NODE_ENV=test` it is `silent`,
unless a `logStream` (any object with `write(message)`) is passed to `buildApp()`; then logs at
`info` go to that stream, which lets tests inspect them.

The logger redacts these paths (the value becomes `[Redacted]`):

| Path                        | Hides                        |
| --------------------------- | ---------------------------- |
| `req.headers.authorization` | Bearer or basic credentials  |
| `req.headers.cookie`        | The `session` cookie         |
| `res.headers["set-cookie"]` | A newly issued session token |
| `password`, `*.password`    | Passwords in logged objects  |

## Database

`buildApp()` creates one Prisma client with `createDb(env.DATABASE_URL)` and exposes it as
`app.db`. An `onClose` hook calls `app.db.$disconnect()`, so `app.close()` releases the
connection pool.

| File                          | Purpose                                                                                                         |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `server/prisma/schema.prisma` | Models and enums. The generator writes the client to `server/src/generated/prisma`.                             |
| `server/prisma/migrations/`   | Committed SQL migrations (`20261108231028_init`).                                                               |
| `server/prisma.config.ts`     | Prisma CLI config: schema and migrations paths, seed command, `DATABASE_URL`. Loads `server/.env` if it exists. |
| `server/prisma/seed.ts`       | Demo data seed (see [`setup.md`](./setup.md#database-scripts)).                                                 |

The generated client (`server/src/generated/`) is git-ignored. `npm --prefix server ci` creates
it through the `postinstall` script (`prisma generate`). ESLint and coverage skip it.

## Data model

Table names match the model names. Every model has `userId`, `createdAt` (default `now()`) and
`updatedAt` (set by Prisma on update). Primary keys are UUIDs generated by Prisma, except
`Goals`, whose key is `userId`.

| Model         | Fields                                                                                                                           |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `User`        | `id`, `email` (unique, lowercase), `passwordHash`                                                                                |
| `Goals`       | `userId` (key, one row per user), `unit` (`Unit`), `calories`, `protein`, `carbs`, `fat`, `targetWeight`, `waterL`, `sleepHours` |
| `Workout`     | `id`, `userId`, `date`, `name`, `durationMin?`, `notes?`                                                                         |
| `Exercise`    | `id`, `userId`, `workoutId`, `position`, `name`, `muscle`                                                                        |
| `WorkoutSet`  | `id`, `userId`, `exerciseId`, `position`, `reps`, `weight`                                                                       |
| `FoodEntry`   | `id`, `userId`, `date`, `meal` (`Meal`), `name`, `calories`, `protein`, `carbs`, `fat`                                           |
| `BodyEntry`   | `id`, `userId`, `date`, `weight`, `bodyFat?`, `chest?`, `waist?`, `arms?`, `thighs?`                                             |
| `HealthEntry` | `id`, `userId`, `date`, `sleepHours?`, `waterL?`, `restingHR?`, `steps?`, `energy?`, `notes?`                                    |

`?` marks a nullable column. Enums: `Unit` is `kg` or `lb` (the user's display unit); `Meal` is
`Breakfast`, `Lunch`, `Dinner` or `Snack`.

`Exercise` and `WorkoutSet` also store `userId`, so every table can be filtered by the owner
directly.

### Types and units

| Data                                                                            | Column type        | Unit / format                                      |
| ------------------------------------------------------------------------------- | ------------------ | -------------------------------------------------- |
| `WorkoutSet.weight`, `BodyEntry.weight`, `Goals.targetWeight`                   | `Decimal(6,2)`     | kg, always (converted for display only)            |
| `BodyEntry.chest`, `waist`, `arms`, `thighs`                                    | `Decimal(6,2)`     | cm                                                 |
| `date` on `Workout`, `FoodEntry`, `BodyEntry`, `HealthEntry`                    | `date`             | Calendar day; Prisma returns a `Date` at 00:00 UTC |
| `name`, `muscle`                                                                | `varchar(100)`     |                                                    |
| `notes`                                                                         | `varchar(2000)`    |                                                    |
| `reps`, `position`, `steps`, `energy`                                           | `integer`          |                                                    |
| Macros, calories, `durationMin`, `bodyFat`, `waterL`, `sleepHours`, `restingHR` | `double precision` |                                                    |

Prisma returns `Decimal` columns as `Prisma.Decimal` objects; call `.toNumber()` to get a number.

### Constraints and indexes

| Constraint                                                  | Effect                                                                      |
| ----------------------------------------------------------- | --------------------------------------------------------------------------- |
| `User_email_key` (unique)                                   | One account per email (`P2002` on a duplicate).                             |
| `User_email_lowercase` (`CHECK ("email" = lower("email"))`) | Rejects emails with uppercase letters. Callers must lowercase emails first. |
| `Goals` primary key `userId`                                | At most one goals row per user.                                             |
| `HealthEntry_userId_date_key` (unique)                      | One health entry per user per day (`P2002` on a second one).                |
| `Exercise_workoutId_position_key` (unique)                  | `position` orders exercises within a workout, starting at 0.                |
| `WorkoutSet_exerciseId_position_key` (unique)               | `position` orders sets within an exercise, starting at 0.                   |
| Indexes on `(userId, date)`                                 | `Workout`, `FoodEntry`, `BodyEntry` (`HealthEntry` uses its unique key).    |
| Indexes on `userId`                                         | `Exercise`, `WorkoutSet`.                                                   |

The lowercase `CHECK` was added by hand to the `init` migration SQL. Prisma does not model `CHECK`
constraints, so it is not in `schema.prisma`.

### Cascades

All foreign keys use `ON DELETE CASCADE`.

| Deleting   | Also deletes                                                                                        |
| ---------- | --------------------------------------------------------------------------------------------------- |
| `User`     | Their `Goals`, `Workout`, `Exercise`, `WorkoutSet`, `FoodEntry`, `BodyEntry` and `HealthEntry` rows |
| `Workout`  | Its `Exercise` rows and their `WorkoutSet` rows                                                     |
| `Exercise` | Its `WorkoutSet` rows                                                                               |

## Configuration

`parseEnv()` validates these variables at startup. If any is missing or invalid, it throws and
the process exits with a non-zero code before listening.

| Variable       | Rules                                      | Default |
| -------------- | ------------------------------------------ | ------- |
| `NODE_ENV`     | `development`, `test` or `production`      | none    |
| `PORT`         | Integer 1–65535                            | `3000`  |
| `DATABASE_URL` | A valid URL (PostgreSQL connection string) | none    |
| `JWT_SECRET`   | String of at least 32 characters           | none    |

`DATABASE_URL` is passed to `createDb()`. `JWT_SECRET` signs and verifies session tokens (`@fastify/jwt`).

## Authentication

`server/src/auth.ts` implements accounts and sessions with `@fastify/cookie`, `@fastify/jwt`,
`@fastify/rate-limit` and `argon2`. Routes are under `/api/v1/auth` (reference in
[`api.md`](./api.md#authentication)).

### Passwords and emails

- Passwords are hashed with argon2id (`argon2.hash(password, { type: argon2id })`, library
  default cost). Register accepts 10–128 characters; login and account deletion accept 1–128.
- Emails are trimmed and lowercased before validation, which satisfies the `User_email_lowercase`
  constraint. A duplicate email (`P2002`) returns 409.
- Login returns the same 401 `Invalid email or password` for an unknown email and a wrong
  password. For an unknown email it still runs `argon2.verify` against a dummy hash
  (`DUMMY_HASH`), so both cases take about the same time. A stored hash that is not a valid
  argon2 string (such as the seed user's empty `passwordHash`) fails verification with 401.
- Responses only ever select `id` and `email` (`PUBLIC_USER`); `passwordHash` is never returned.

### Sessions

| Setting   | Value                                                                     |
| --------- | ------------------------------------------------------------------------- |
| Token     | JWT, `HS256`, payload `{ sub: <userId> }`, `expiresIn` 7 days             |
| Secret    | `JWT_SECRET`                                                              |
| Transport | `session` cookie only (`onlyCookie: true`); Bearer headers ignored        |
| Cookie    | `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/api/v1`, `Max-Age` 7 days |
| Verify    | Only `HS256` accepted; signature and expiry checked                       |

Sessions are stateless. Logout and account deletion clear the cookie but do not revoke the
token itself; it stays cryptographically valid until it expires. After account deletion,
`requireAuth` rejects it because the user no longer exists.

### `requireAuth`

`app.requireAuth` is a `preHandler`. It verifies the session cookie, sets `request.userId`
(the token's `sub`) and checks that the user still exists. Any failure (missing, expired,
tampered, wrong secret, deleted user) throws 401 `Not authenticated`. Use it on every route that needs a user:

```ts
app.get('/me', { preHandler: app.requireAuth }, async (request) => { /* request.userId */ })
```

### Origin check (CSRF)

A global `onRequest` hook rejects any request whose method is not `GET`, `HEAD` or `OPTIONS`
when it has an `Origin` header whose host (from `URL.parse`) differs from `request.host`. It
returns 403 `Cross-origin request rejected`, before body parsing and before any route runs.
`Origin: null` or an unparseable value is also rejected. Requests without `Origin` pass; the
`SameSite=Strict` cookie covers them. Together these are the CSRF protection from
PRODUCTION_RULES §3.4.

### Rate limit

`@fastify/rate-limit` is registered with `global: false`. Each auth route sets
`config.rateLimit` to 10 requests per minute. The limit is counted per client IP
(`request.ip`) and per route. The 11th request returns 429 Problem Details
(`Rate limit exceeded, retry in 1 minute`) with a `Retry-After` header. Other routes have no
rate limit.

## Workouts

`server/src/workouts.ts` exports `workoutRoutes`, a Fastify plugin that `buildApp()` registers
with the prefix `/api/v1/workouts` (reference in [`api.md`](./api.md#workouts)).

- **Auth and scoping.** The plugin adds `app.requireAuth` as a `preHandler` hook, so every route
  in it requires a session. Every query filters by `request.userId`; another user's workout is
  not found and returns 404 `Workout not found`.
- **Validation.** `:id` and `from` / `to` are checked with the helpers in `server/src/routes.ts`
  (`z.uuid()` and `ISODateSchema`). Bodies are parsed with `WorkoutSchema` from `shared/` with `id` removed from the workout and from each
  exercise (`WORKOUT_INPUT_SCHEMA`); Zod strips unknown keys, so client ids are ignored and the
  database generates them. A `ZodError` becomes 400 in the global error handler.
- **Order.** Exercises and sets get `position` from their index in the request (starting at 0)
  and are read back ordered by `position`.
- **Response mapping.** `toWorkout()` turns a row into the shared `Workout` shape: `date` becomes
  `yyyy-mm-dd`, `weight` (`Decimal`) becomes a number with `.toNumber()`, and null
  `durationMin` / `notes` are left out.
- **List.** Ordered by `date` desc, then `createdAt` desc. `from` defaults to 90 days before the
  current UTC day (`DEFAULT_RANGE_DAYS`, passed to `parseDateRange()`); `to` has no default.
- **Create.** One nested `workout.create` writes the workout, exercises and sets atomically.
- **Replace (PUT).** Inside `app.db.$transaction`, it checks that the workout belongs to the user,
  deletes all of its `Exercise` rows (their sets go by cascade) and updates the workout with the
  new fields and newly created exercises and sets. Exercises missing from the body are therefore
  removed, every exercise and set gets a new id, and the workout keeps its id. If any step
  fails, nothing changes.
- **Delete.** `deleteMany` with `id` and `userId`; a count of 0 returns 404. Exercises and sets go
  by cascade.

## Foods

`server/src/foods.ts` exports `foodRoutes`, a Fastify plugin that `buildApp()` registers with the
prefix `/api/v1/foods` (reference in [`api.md`](./api.md#foods)).

- **Auth and scoping.** The plugin adds `app.requireAuth` as a `preHandler` hook. Every query
  filters by `request.userId`; another user's entry returns 404 `Food entry not found`.
- **Validation.** Bodies are parsed with `FoodEntrySchema` from `shared/` without `id`
  (`FOOD_INPUT_SCHEMA`), so `meal` must be one of `MEALS` and the database generates the id.
  `:id` and `from` / `to` use the helpers in `server/src/routes.ts`. `limit` on `/recent` is
  coerced to an integer 1–50 (default 20).
- **Response mapping.** `toFoodEntry()` turns a row into the shared `FoodEntry` shape, with
  `date` as `yyyy-mm-dd`.
- **List.** Ordered by `date` desc, then `createdAt` desc. `from` defaults to 30 days before the
  current UTC day (`DEFAULT_RANGE_DAYS`); `to` has no default.
- **Recent.** `GET /recent` is registered before the `/:id` routes. It reads the user's entries
  ordered by `createdAt` desc (then `id` desc) in batches of 100 (`RECENT_BATCH_SIZE`) and keeps
  the first entry for each lowercased name until it has `limit` names or runs out of rows.
- **Replace (PUT) and delete.** `updateMany` / `deleteMany` with `id` and `userId`; a count of 0
  returns 404. PUT returns the parsed body with the path `id`.

## Body

`server/src/body.ts` exports `bodyRoutes`, a Fastify plugin that `buildApp()` registers with the
prefix `/api/v1/body` (reference in [`api.md`](./api.md#body)).

- **Auth and scoping.** The plugin adds `app.requireAuth` as a `preHandler` hook. Every query
  filters by `request.userId`; another user's entry returns 404 `Body entry not found`.
- **Validation.** Bodies are parsed with `BodyEntrySchema` from `shared/` without `id`
  (`BODY_INPUT_SCHEMA`). `:id` and `from` / `to` use the helpers in `server/src/routes.ts`.
- **Response mapping.** `toBodyEntry()` turns a row into the shared `BodyEntry` shape: `date`
  becomes `yyyy-mm-dd`, the `Decimal` columns become numbers with `.toNumber()`, and null optional
  fields are left out.
- **List.** Ordered by `date` desc, then `createdAt` desc. `from` defaults to 90 days before the
  current UTC day (`DEFAULT_RANGE_DAYS`); `to` has no default.
- **Replace (PUT).** `toBodyData()` sets every optional field the body leaves out to `null`, so
  PUT replaces the full entry. `updateManyAndReturn` with `id` and `userId` returns the updated
  row; no row returns 404.
- **Delete.** `deleteMany` with `id` and `userId`; a count of 0 returns 404.

## Health entries

`server/src/health.ts` exports `healthRoutes`, a Fastify plugin that `buildApp()` registers with
the prefix `/api/v1/health-entries` (reference in [`api.md`](./api.md#health-entries)).

- **Auth and scoping.** The plugin adds `app.requireAuth` as a `preHandler` hook. Every query
  filters by `request.userId`.
- **Validation.** `:date` is checked with `ISODateSchema` (`DATE_PARAMS_SCHEMA`). Bodies are
  parsed with `HealthEntrySchema` from `shared/` without `id` and `date`
  (`HEALTH_INPUT_SCHEMA`), so the date always comes from the path.
- **Response mapping.** `toHealthEntry()` turns a row into the shared `HealthEntry` shape, with
  `date` as `yyyy-mm-dd` and null fields left out.
- **List.** Ordered by `date` desc. `from` defaults to 30 days before the current UTC day
  (`DEFAULT_RANGE_DAYS`); `to` has no default.
- **Upsert (PUT).** `upsert` on the `userId_date` unique key (`HealthEntry_userId_date_key`)
  creates or updates the user's entry for the day and always returns 200. Fields the body leaves
  out are set to `null`, so PUT replaces the full entry. An update keeps the row's `id`.
- **Delete.** `deleteMany` with `userId` and `date`; a count of 0 returns 404
  `Health entry not found`.

## Goals

`server/src/goals.ts` exports `goalsRoutes`, a Fastify plugin that `buildApp()` registers with
the prefix `/api/v1/goals` (reference in [`api.md`](./api.md#goals)).

- **Auth and scoping.** The plugin adds `app.requireAuth` as a `preHandler` hook. Both queries
  use `request.userId` as the key of the `Goals` row.
- **Defaults.** `DEFAULT_GOALS` is exported from `server/src/auth.ts`. Register creates the
  user's `Goals` row with it, and `GET` returns it when the user has no row, without creating one.
- **Validation.** `PUT` parses the full body with `GoalsSchema` from `shared/`; a partial or
  invalid body is a `ZodError` and returns 400.
- **Upsert (PUT).** `upsert` on `userId` creates or replaces the row and always returns 200.
- **Response mapping.** `toGoals()` turns a row into the shared `Goals` shape; `targetWeight`
  (`Decimal(6,2)`, kg) becomes a number with `.toNumber()`, so it is rounded to 2 decimals.

## Numeric limits

Numbers in `shared/schemas.ts` have upper limits, so a value that passes validation fits its
column and oversized input returns 400, not 500. The only number without an upper limit is
workout `durationMin` (≥ 0), a `double precision` column that holds any finite number.

| Fields                                            | Rule             | Constant             |
| ------------------------------------------------- | ---------------- | -------------------- |
| Set `weight`, body `weight`, goals `targetWeight` | 0–2000 kg        | `WEIGHT_MAX`         |
| Set `reps`                                        | Integer 0–1000   | `REPS_MAX`           |
| Body `chest`, `waist`, `arms`, `thighs`           | 0–1000 cm        | `MEASUREMENT_CM_MAX` |
| Body `bodyFat`                                    | 0–100 %          |                      |
| Health `steps`                                    | Integer 0–200000 | `STEPS_MAX`          |
| Health `restingHR`                                | 0–300            | `RESTING_HR_MAX`     |
| Health and goals `waterL`                         | 0–20 L           | `WATER_L_MAX`        |
| Health and goals `sleepHours`                     | 0–24             |                      |
| Health `energy`                                   | Integer 1–5      |                      |
| Food and goals `calories`                         | 0–20000          | `CALORIES_MAX`       |
| Food and goals `protein`, `carbs`, `fat`          | 0–2000 g         | `MACRO_G_MAX`        |

## Error handling

Every error response is RFC 9457 Problem Details, sent with
`Content-Type: application/problem+json` (format in [`api.md`](./api.md#errors)). Only standard
HTTP status codes are used.

| Source                                                                            | Status           | `detail`                                                                     |
| --------------------------------------------------------------------------------- | ---------------- | ---------------------------------------------------------------------------- |
| A thrown `ZodError`                                                               | 400              | `Invalid input`, plus `errors: [{ path, message }]` (path joined with `.`)   |
| Unknown route (`setNotFoundHandler`)                                              | 404              | `Route <METHOD> <url> not found`                                             |
| `app.httpErrors.*` from `@fastify/sensible`, or any error with a 4xx `statusCode` | That status      | The error message                                                            |
| `@fastify/rate-limit`                                                             | 429              | `Rate limit exceeded, retry in 1 minute`                                     |
| Any other error (or a 5xx `statusCode`)                                           | 500 (or the 5xx) | The error message in `development`; `An unexpected error occurred` otherwise |

`title` is the standard reason phrase for the status (from `node:http` `STATUS_CODES`). 5xx
errors are logged with `request.log.error`. Stack traces and internal messages never reach the
response outside `development`.

Route handlers throw `app.httpErrors.<name>(detail)` for expected failures (for example
`app.httpErrors.conflict('Email already registered')`) and let the global handler format them.

_Last updated by TB07._
