# API

All endpoints live under `/api/v1` and return JSON. The browser reaches them through the
gateway on the same origin; the API itself is never published (`127.0.0.1` in development, a
private container network in production).

Outside production, `GET /docs` returns the OpenAPI JSON document. In production it returns 404.

## Errors

Errors use RFC 9457 Problem Details with `Content-Type: application/problem+json` and standard
HTTP status codes only.

```json
{ "type": "about:blank", "title": "Not Found", "status": 404, "detail": "Route GET /api/v1/nope not found" }
```

Validation errors (400) add an `errors` array of `{ path, message }`:

```json
{
  "type": "about:blank",
  "title": "Bad Request",
  "status": 400,
  "detail": "Invalid input",
  "errors": [{ "path": "name", "message": "Invalid input: expected string, received number" }]
}
```

| Field    | Meaning                                                                                 |
| -------- | --------------------------------------------------------------------------------------- |
| `type`   | Always `about:blank`                                                                    |
| `title`  | Standard reason phrase for `status`                                                     |
| `status` | HTTP status code                                                                        |
| `detail` | Human-readable explanation. For 500 outside development: `An unexpected error occurred` |
| `errors` | 400 only: one entry per invalid field                                                   |

## Authentication

A successful register or login sets a `session` cookie that holds a JWT (HS256, 7-day expiry).
The browser sends it back automatically; `Authorization: Bearer` headers are ignored.

| Cookie attribute | Value             |
| ---------------- | ----------------- |
| `HttpOnly`       | yes               |
| `Secure`         | yes               |
| `SameSite`       | `Strict`          |
| `Path`           | `/api/v1`         |
| `Max-Age`        | `604800` (7 days) |

Endpoints marked `Auth: required` return 401 (`Not authenticated`) when the cookie is missing,
expired, tampered with or signed with another secret.

The auth request bodies are validated with `RegisterSchema`, `LoginSchema` and
`DeleteAccountSchema` from `shared/schemas.ts`, the same schemas the login, register and
delete-account forms use. Their 400 `errors` entries carry these messages:

| `path`     | Rule broken                         | `message`                                 |
| ---------- | ----------------------------------- | ----------------------------------------- |
| `email`    | Not a valid email                   | `Enter a valid email address`             |
| `email`    | Over 254 characters                 | `Email is too long`                       |
| `password` | Empty                               | `Enter your password`                     |
| `password` | Over 128 characters                 | `Password must be at most 128 characters` |
| `password` | Under 10 characters (register only) | `Password must be at least 10 characters` |

A field of the wrong type (for example a number) keeps the default Zod message, and a NUL
character returns `Must not contain NUL characters`.

## Request protection

| Rule              | Applies to                                    | Response                                                                                                                           |
| ----------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Origin check      | Every request except `GET`, `HEAD`, `OPTIONS` | 403 `Cross-origin request rejected` if `Origin` is present and its host differs from the request `Host` (including `Origin: null`) |
| Auth rate limit   | Each `/api/v1/auth/*` route, per client IP    | 429 after 10 requests in 1 minute, with a `Retry-After` header                                                                     |
| Global rate limit | Every other route, per client IP              | 429 after 300 requests in 1 minute, with a `Retry-After` header                                                                    |
| Body limit        | Every request body                            | 413 `Request body is too large` over 100 KB (5 MB for `POST /api/v1/backup/import`)                                                |

Requests without an `Origin` header are not blocked by the Origin check.

Every response carries the `@fastify/helmet` security headers (including
`Content-Security-Policy`) and `X-RateLimit-Limit`, `X-RateLimit-Remaining` and
`X-RateLimit-Reset`. Through the gateway, `deploy/Caddyfile` overwrites the headers it also
sets, such as `Content-Security-Policy` and `X-Frame-Options` (see
[`architecture.md`](./architecture.md#gateway)).

## Endpoints

### GET /api/v1/health

Auth: none

Liveness check.

**Responses**

| Status | Body                 |
| ------ | -------------------- |
| 200    | `{ "status": "ok" }` |

### POST /api/v1/auth/register

Auth: none · Rate limit: 10/min per IP

Creates an account with the default goals and starts a session.

**Request**

| Field      | Type   | Rules                                                     |
| ---------- | ------ | --------------------------------------------------------- |
| `email`    | string | Trimmed and lowercased, then a valid email of ≤ 254 chars |
| `password` | string | 10–128 characters                                         |

**Responses**

| Status | Body                                                        |
| ------ | ----------------------------------------------------------- |
| 201    | `{ "id": "<uuid>", "email": "<email>" }` + `session` cookie |
| 400    | Problem Details with `errors`                               |
| 403    | Problem Details (foreign `Origin`)                          |
| 409    | Problem Details, `detail`: `Email already registered`       |
| 429    | Problem Details                                             |

Default goals: `unit` `kg`, `calories` 2800, `protein` 200, `carbs` 320, `fat` 80,
`targetWeight` 85, `waterL` 4, `sleepHours` 8.

### POST /api/v1/auth/login

Auth: none · Rate limit: 10/min per IP

**Request**

| Field      | Type   | Rules                                                     |
| ---------- | ------ | --------------------------------------------------------- |
| `email`    | string | Trimmed and lowercased, then a valid email of ≤ 254 chars |
| `password` | string | 1–128 characters                                          |

**Responses**

| Status | Body                                                                                     |
| ------ | ---------------------------------------------------------------------------------------- |
| 200    | `{ "id": "<uuid>", "email": "<email>" }` + `session` cookie                              |
| 400    | Problem Details with `errors`                                                            |
| 401    | Problem Details, `detail`: `Invalid email or password` (unknown email or wrong password) |
| 403    | Problem Details (foreign `Origin`)                                                       |
| 429    | Problem Details                                                                          |

### POST /api/v1/auth/logout

Auth: none · Rate limit: 10/min per IP

Clears the `session` cookie. No body.

**Responses**

| Status | Body                                          |
| ------ | --------------------------------------------- |
| 204    | Empty; `session` cookie set to an empty value |
| 403    | Problem Details (foreign `Origin`)            |
| 429    | Problem Details                               |

### GET /api/v1/auth/me

Auth: required · Rate limit: 10/min per IP

**Responses**

| Status | Body                                           |
| ------ | ---------------------------------------------- |
| 200    | `{ "id": "<uuid>", "email": "<email>" }`       |
| 401    | Problem Details, `detail`: `Not authenticated` |
| 429    | Problem Details                                |

### DELETE /api/v1/auth/account

Auth: required · Rate limit: 10/min per IP

Deletes the user and all of their data (goals, workouts, exercises, sets, food, body and health
entries), then clears the `session` cookie.

**Request**

| Field      | Type   | Rules            |
| ---------- | ------ | ---------------- |
| `password` | string | 1–128 characters |

**Responses**

| Status | Body                                                                                    |
| ------ | --------------------------------------------------------------------------------------- |
| 204    | Empty; `session` cookie set to an empty value                                           |
| 400    | Problem Details with `errors`                                                           |
| 401    | Problem Details, `detail`: `Not authenticated` (no valid session) or `Invalid password` |
| 403    | Problem Details (foreign `Origin`)                                                      |
| 429    | Problem Details                                                                         |

### Workouts

All `/api/v1/workouts` routes require a session and only see the current user's workouts. A
workout that belongs to another user returns 404, the same as one that does not exist. `:id` must
be a UUID; any other value returns 400.

**`Workout` (response body)**

Matches `WorkoutSchema` in `shared/schemas.ts`.

| Field                       | Type   | Notes                                                   |
| --------------------------- | ------ | ------------------------------------------------------- |
| `id`                        | string | UUID generated by the server                            |
| `date`                      | string | Calendar day, `yyyy-mm-dd`                              |
| `name`                      | string | 1–100 characters, trimmed                               |
| `durationMin`               | number | ≥ 0. Omitted when not set                               |
| `notes`                     | string | ≤ 2000 characters, trimmed. Omitted when not set        |
| `exercises`                 | array  | In the order they were sent                             |
| `exercises[].id`            | string | UUID generated by the server                            |
| `exercises[].name`          | string | 1–100 characters, trimmed                               |
| `exercises[].muscle`        | string | 1–100 characters, trimmed                               |
| `exercises[].sets`          | array  | In the order they were sent                             |
| `exercises[].sets[].reps`   | number | Integer 0–1000                                          |
| `exercises[].sets[].weight` | number | kg, 0–2000. Stored as `Decimal(6,2)` (2 decimal places) |

**`WorkoutInput` (request body for POST and PUT)**

The same fields as `Workout`, without the `id` of the workout or of its exercises. `id` values in
the body are ignored, as are unknown fields. `durationMin` and `notes` are optional.

### GET /api/v1/workouts

Auth: required

Lists workouts, newest `date` first (ties: most recently created first).

**Query**

| Field  | Type   | Rules                                                                 |
| ------ | ------ | --------------------------------------------------------------------- |
| `from` | string | Optional `yyyy-mm-dd`, inclusive. Default: 90 days before today (UTC) |
| `to`   | string | Optional `yyyy-mm-dd`, inclusive. Default: no upper bound             |

**Responses**

| Status | Body                                           |
| ------ | ---------------------------------------------- |
| 200    | `Workout[]` (empty array if none)              |
| 400    | Problem Details with `errors` (invalid date)   |
| 401    | Problem Details, `detail`: `Not authenticated` |

### GET /api/v1/workouts/:id

Auth: required

**Responses**

| Status | Body                                               |
| ------ | -------------------------------------------------- |
| 200    | `Workout`                                          |
| 400    | Problem Details with `errors` (`id` is not a UUID) |
| 401    | Problem Details, `detail`: `Not authenticated`     |
| 404    | Problem Details, `detail`: `Workout not found`     |

### POST /api/v1/workouts

Auth: required

Creates a workout with its exercises and sets in one statement.

**Request:** `WorkoutInput`

**Responses**

| Status | Body                                           |
| ------ | ---------------------------------------------- |
| 201    | `Workout`                                      |
| 400    | Problem Details with `errors`                  |
| 401    | Problem Details, `detail`: `Not authenticated` |
| 403    | Problem Details (foreign `Origin`)             |

### PUT /api/v1/workouts/:id

Auth: required

Replaces the whole workout in one transaction. All existing exercises and sets are deleted and
the ones in the body are created, so exercises left out of the body are removed and every
exercise gets a new `id`. The workout `id` stays the same.

**Request:** `WorkoutInput`

**Responses**

| Status | Body                                                            |
| ------ | --------------------------------------------------------------- |
| 200    | `Workout`                                                       |
| 400    | Problem Details with `errors` (invalid body or `id` not a UUID) |
| 401    | Problem Details, `detail`: `Not authenticated`                  |
| 403    | Problem Details (foreign `Origin`)                              |
| 404    | Problem Details, `detail`: `Workout not found`                  |

### DELETE /api/v1/workouts/:id

Auth: required

Deletes the workout with its exercises and sets.

**Responses**

| Status | Body                                               |
| ------ | -------------------------------------------------- |
| 204    | Empty                                              |
| 400    | Problem Details with `errors` (`id` is not a UUID) |
| 401    | Problem Details, `detail`: `Not authenticated`     |
| 403    | Problem Details (foreign `Origin`)                 |
| 404    | Problem Details, `detail`: `Workout not found`     |

### Foods

All `/api/v1/foods` routes require a session and only see the current user's food entries. An
entry that belongs to another user returns 404, the same as one that does not exist. `:id` must be
a UUID; any other value returns 400.

**`FoodEntry` (response body)**

Matches `FoodEntrySchema` in `shared/schemas.ts`.

| Field      | Type   | Notes                                                   |
| ---------- | ------ | ------------------------------------------------------- |
| `id`       | string | UUID generated by the server                            |
| `date`     | string | Calendar day, `yyyy-mm-dd`                              |
| `meal`     | string | One of `MEALS`: `Breakfast`, `Lunch`, `Dinner`, `Snack` |
| `name`     | string | 1–100 characters, trimmed                               |
| `calories` | number | 0–20000                                                 |
| `protein`  | number | Grams, 0–2000                                           |
| `carbs`    | number | Grams, 0–2000                                           |
| `fat`      | number | Grams, 0–2000                                           |

**`FoodInput` (request body for POST and PUT)**

The same fields as `FoodEntry`, without `id`. All fields are required. An `id` in the body is
ignored, as are unknown fields.

### GET /api/v1/foods

Auth: required

Lists food entries, newest `date` first (ties: most recently created first).

**Query**

| Field  | Type   | Rules                                                                 |
| ------ | ------ | --------------------------------------------------------------------- |
| `from` | string | Optional `yyyy-mm-dd`, inclusive. Default: 30 days before today (UTC) |
| `to`   | string | Optional `yyyy-mm-dd`, inclusive. Default: no upper bound             |

**Responses**

| Status | Body                                           |
| ------ | ---------------------------------------------- |
| 200    | `FoodEntry[]` (empty array if none)            |
| 400    | Problem Details with `errors` (invalid date)   |
| 401    | Problem Details, `detail`: `Not authenticated` |

### GET /api/v1/foods/recent

Auth: required

Lists recently logged foods with one entry per name, for quick re-entry. Names are compared
case-insensitively. Each name is returned once, as its most recently created entry, and the list
is ordered by creation time, newest first. All dates are searched.

**Query**

| Field   | Type   | Rules                              |
| ------- | ------ | ---------------------------------- |
| `limit` | number | Optional integer 1–50. Default: 20 |

**Responses**

| Status | Body                                           |
| ------ | ---------------------------------------------- |
| 200    | `FoodEntry[]`, at most `limit` items           |
| 400    | Problem Details with `errors` (invalid limit)  |
| 401    | Problem Details, `detail`: `Not authenticated` |

### POST /api/v1/foods

Auth: required

**Request:** `FoodInput`

**Responses**

| Status | Body                                           |
| ------ | ---------------------------------------------- |
| 201    | `FoodEntry`                                    |
| 400    | Problem Details with `errors`                  |
| 401    | Problem Details, `detail`: `Not authenticated` |
| 403    | Problem Details (foreign `Origin`)             |

### PUT /api/v1/foods/:id

Auth: required

Replaces every field of the entry. The `id` stays the same.

**Request:** `FoodInput`

**Responses**

| Status | Body                                                            |
| ------ | --------------------------------------------------------------- |
| 200    | `FoodEntry`                                                     |
| 400    | Problem Details with `errors` (invalid body or `id` not a UUID) |
| 401    | Problem Details, `detail`: `Not authenticated`                  |
| 403    | Problem Details (foreign `Origin`)                              |
| 404    | Problem Details, `detail`: `Food entry not found`               |

### DELETE /api/v1/foods/:id

Auth: required

**Responses**

| Status | Body                                               |
| ------ | -------------------------------------------------- |
| 204    | Empty                                              |
| 400    | Problem Details with `errors` (`id` is not a UUID) |
| 401    | Problem Details, `detail`: `Not authenticated`     |
| 403    | Problem Details (foreign `Origin`)                 |
| 404    | Problem Details, `detail`: `Food entry not found`  |

### Body

All `/api/v1/body` routes require a session and only see the current user's body entries. An
entry that belongs to another user returns 404, the same as one that does not exist. `:id` must be
a UUID; any other value returns 400.

**`BodyEntry` (response body)**

Matches `BodyEntrySchema` in `shared/schemas.ts`.

| Field     | Type   | Notes                                                                         |
| --------- | ------ | ----------------------------------------------------------------------------- |
| `id`      | string | UUID generated by the server                                                  |
| `date`    | string | Calendar day, `yyyy-mm-dd`                                                    |
| `weight`  | number | kg, 0–2000. Stored as `Decimal(6,2)` (2 decimal places)                       |
| `bodyFat` | number | Percent, 0–100. Omitted when not set                                          |
| `chest`   | number | cm, 0–1000. Stored as `Decimal(6,2)` (2 decimal places). Omitted when not set |
| `waist`   | number | cm, 0–1000. Stored as `Decimal(6,2)` (2 decimal places). Omitted when not set |
| `arms`    | number | cm, 0–1000. Stored as `Decimal(6,2)` (2 decimal places). Omitted when not set |
| `thighs`  | number | cm, 0–1000. Stored as `Decimal(6,2)` (2 decimal places). Omitted when not set |

**`BodyInput` (request body for POST and PUT)**

The same fields as `BodyEntry`, without `id`. `date` and `weight` are required; the others are
optional. An `id` in the body is ignored, as are unknown fields.

### GET /api/v1/body

Auth: required

Lists body entries, newest `date` first (ties: most recently created first).

**Query**

| Field  | Type   | Rules                                                                 |
| ------ | ------ | --------------------------------------------------------------------- |
| `from` | string | Optional `yyyy-mm-dd`, inclusive. Default: 90 days before today (UTC) |
| `to`   | string | Optional `yyyy-mm-dd`, inclusive. Default: no upper bound             |

**Responses**

| Status | Body                                           |
| ------ | ---------------------------------------------- |
| 200    | `BodyEntry[]` (empty array if none)            |
| 400    | Problem Details with `errors` (invalid date)   |
| 401    | Problem Details, `detail`: `Not authenticated` |

### POST /api/v1/body

Auth: required

**Request:** `BodyInput`

**Responses**

| Status | Body                                           |
| ------ | ---------------------------------------------- |
| 201    | `BodyEntry`                                    |
| 400    | Problem Details with `errors`                  |
| 401    | Problem Details, `detail`: `Not authenticated` |
| 403    | Problem Details (foreign `Origin`)             |

### PUT /api/v1/body/:id

Auth: required

Replaces the full entry. Optional fields left out of the body are cleared. The `id` stays the
same.

**Request:** `BodyInput`

**Responses**

| Status | Body                                                            |
| ------ | --------------------------------------------------------------- |
| 200    | `BodyEntry`                                                     |
| 400    | Problem Details with `errors` (invalid body or `id` not a UUID) |
| 401    | Problem Details, `detail`: `Not authenticated`                  |
| 403    | Problem Details (foreign `Origin`)                              |
| 404    | Problem Details, `detail`: `Body entry not found`               |

### DELETE /api/v1/body/:id

Auth: required

**Responses**

| Status | Body                                               |
| ------ | -------------------------------------------------- |
| 204    | Empty                                              |
| 400    | Problem Details with `errors` (`id` is not a UUID) |
| 401    | Problem Details, `detail`: `Not authenticated`     |
| 403    | Problem Details (foreign `Origin`)                 |
| 404    | Problem Details, `detail`: `Body entry not found`  |

### Health entries

All `/api/v1/health-entries` routes require a session and only see the current user's health
entries. A user has at most one entry per day, addressed by its date. `:date` must be a real
`yyyy-mm-dd` day; any other value returns 400. Another user's entry for the same day is never
read or changed.

**`HealthEntry` (response body)**

Matches `HealthEntrySchema` in `shared/schemas.ts`. Every field except `id` and `date` is
omitted when not set.

| Field        | Type   | Notes                        |
| ------------ | ------ | ---------------------------- |
| `id`         | string | UUID generated by the server |
| `date`       | string | Calendar day, `yyyy-mm-dd`   |
| `sleepHours` | number | Hours, 0–24                  |
| `waterL`     | number | Litres, 0–20                 |
| `restingHR`  | number | Beats per minute, 0–300      |
| `steps`      | number | Integer 0–200000             |
| `energy`     | number | Integer 1–5                  |
| `notes`      | string | ≤ 2000 characters, trimmed   |

**`HealthInput` (request body for PUT)**

The same fields as `HealthEntry`, without `id` and `date`; all are optional. The date comes from
the path. An `id` or `date` in the body is ignored, as are unknown fields.

### GET /api/v1/health-entries

Auth: required

Lists health entries, newest `date` first.

**Query**

| Field  | Type   | Rules                                                                 |
| ------ | ------ | --------------------------------------------------------------------- |
| `from` | string | Optional `yyyy-mm-dd`, inclusive. Default: 30 days before today (UTC) |
| `to`   | string | Optional `yyyy-mm-dd`, inclusive. Default: no upper bound             |

**Responses**

| Status | Body                                           |
| ------ | ---------------------------------------------- |
| 200    | `HealthEntry[]` (empty array if none)          |
| 400    | Problem Details with `errors` (invalid date)   |
| 401    | Problem Details, `detail`: `Not authenticated` |

### PUT /api/v1/health-entries/:date

Auth: required

Creates the entry for `:date`, or updates it if one exists (upsert). It always returns 200, for
both a create and an update. PUT replaces the full entry: fields left out of the body are cleared.
An update keeps the entry's `id`.

**Request:** `HealthInput`

**Responses**

| Status | Body                                                         |
| ------ | ------------------------------------------------------------ |
| 200    | `HealthEntry`                                                |
| 400    | Problem Details with `errors` (invalid body or invalid date) |
| 401    | Problem Details, `detail`: `Not authenticated`               |
| 403    | Problem Details (foreign `Origin`)                           |

### DELETE /api/v1/health-entries/:date

Auth: required

**Responses**

| Status | Body                                                |
| ------ | --------------------------------------------------- |
| 204    | Empty                                               |
| 400    | Problem Details with `errors` (invalid date)        |
| 401    | Problem Details, `detail`: `Not authenticated`      |
| 403    | Problem Details (foreign `Origin`)                  |
| 404    | Problem Details, `detail`: `Health entry not found` |

### Goals

Both `/api/v1/goals` routes require a session and only see the current user's goals. A user has
one set of goals.

**`Goals` (request and response body)**

Matches `GoalsSchema` in `shared/schemas.ts`. Every field is required. Unknown fields are
ignored.

| Field          | Type   | Rules                                                       |
| -------------- | ------ | ----------------------------------------------------------- |
| `unit`         | string | `kg` or `lb`: the display unit only                         |
| `calories`     | number | 0–20000                                                     |
| `protein`      | number | Grams, 0–2000                                               |
| `carbs`        | number | Grams, 0–2000                                               |
| `fat`          | number | Grams, 0–2000                                               |
| `targetWeight` | number | Always kg, whatever `unit` is. 0–2000, stored to 2 decimals |
| `waterL`       | number | Litres, 0–20                                                |
| `sleepHours`   | number | Hours, 0–24                                                 |

### GET /api/v1/goals

Auth: required

Returns the user's goals. If the user has no stored goals, it returns the default goals (the
same values as [register](#post-apiv1authregister)) and does not store them.

**Responses**

| Status | Body                                           |
| ------ | ---------------------------------------------- |
| 200    | `Goals`                                        |
| 401    | Problem Details, `detail`: `Not authenticated` |

### PUT /api/v1/goals

Auth: required

Replaces the user's goals, or creates them if none are stored (upsert). It always returns 200.
The body must be a full `Goals` object; a partial body returns 400.

**Request:** `Goals`

**Responses**

| Status | Body                                           |
| ------ | ---------------------------------------------- |
| 200    | `Goals`                                        |
| 400    | Problem Details with `errors`                  |
| 401    | Problem Details, `detail`: `Not authenticated` |
| 403    | Problem Details (foreign `Origin`)             |

### Backup

Both `/api/v1/backup` routes require a session and only read or change the current user's data.

**`AppData` (export body and import body)**

Matches `AppDataSchema` in `shared/schemas.ts`. Unknown fields are ignored. Weights are kg and
measurements cm, unless the import says otherwise with `unitHint=lb`.

| Field      | Type   | Rules                                     |
| ---------- | ------ | ----------------------------------------- |
| `version`  | number | Must be `1`                               |
| `workouts` | array  | `Workout` objects, as in the workouts API |
| `foods`    | array  | `FoodEntry` objects                       |
| `body`     | array  | `BodyEntry` objects                       |
| `health`   | array  | `HealthEntry` objects                     |
| `goals`    | object | `Goals`                                   |

Each entry has an `id` (1–100 characters). Collections are newest first.

### GET /api/v1/backup

Auth: required

Returns all of the user's workouts, foods, body entries, health entries and goals (the default
goals if none are stored). The response has
`Content-Disposition: attachment; filename="ironlog-backup-YYYY-MM-DD.json"`, with the current
UTC date.

**Responses**

| Status | Body                                           |
| ------ | ---------------------------------------------- |
| 200    | `AppData`                                      |
| 401    | Problem Details, `detail`: `Not authenticated` |

### POST /api/v1/backup/import

Auth: required

Imports an `AppData` file. The whole import runs in one transaction: if anything fails, no data
changes.

**Query**

| Param      | Type   | Rules                                                                                                                                                                                                                  |
| ---------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mode`     | string | Required. `merge` adds only new entries; `replace` deletes all of the user's data first                                                                                                                                |
| `unitHint` | string | `kg` (default) or `lb`. With `lb`, set and body `weight` and goals `targetWeight` are converted from lb to kg, and body `chest`, `waist`, `arms`, `thighs` from inches to cm, rounded to 2 decimals, before validation |

**Request:** `AppData`, at most 5 MB.

| Rule   | Behaviour                                                                                                                                                                              |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ids    | An unused UUID is kept. A non-UUID id, or a UUID that belongs to another user, gets a new UUID. An id the user already has, or a UUID repeated in the file, is skipped as a duplicate. |
| Health | One entry per day: an entry for a date the user already has is skipped.                                                                                                                |
| Goals  | `replace` overwrites the goals; `merge` keeps the existing goals and counts the file's goals as skipped.                                                                               |
| Limits | The shared limits apply after any lb conversion (for example 4000 lb is accepted as 1814.37 kg).                                                                                       |

**Responses**

| Status | Body                                                                                                  |
| ------ | ----------------------------------------------------------------------------------------------------- |
| 200    | `{ imported: Counts, skipped: Counts }`, where `Counts` is `{ workouts, foods, body, health, goals }` |
| 400    | Problem Details with `errors` (invalid file, `mode` or `unitHint`), or invalid JSON                   |
| 401    | Problem Details, `detail`: `Not authenticated`                                                        |
| 403    | Problem Details (foreign `Origin`)                                                                    |
| 409    | Problem Details, `detail`: `Import conflicted with concurrent changes; retry`                         |
| 413    | Problem Details, `detail`: `Request body is too large` (body over 5 MB)                               |

Example 200 body:

```json
{
  "imported": { "workouts": 3, "foods": 2, "body": 2, "health": 2, "goals": 1 },
  "skipped": { "workouts": 0, "foods": 0, "body": 0, "health": 0, "goals": 0 }
}
```

An export larger than 5 MB cannot be imported. The import times out after 120 s and then
returns 500 with no changes.

_Last updated by TF03._
