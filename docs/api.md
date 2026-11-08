# API

All endpoints live under `/api/v1` and return JSON. The browser reaches them through the
gateway on the same origin; the API itself listens on `127.0.0.1` only.

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

## Request protection

| Rule            | Applies to                                    | Response                                                                                                                           |
| --------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Origin check    | Every request except `GET`, `HEAD`, `OPTIONS` | 403 `Cross-origin request rejected` if `Origin` is present and its host differs from the request `Host` (including `Origin: null`) |
| Auth rate limit | Each `/api/v1/auth/*` route, per client IP    | 429 after 10 requests in 1 minute, with a `Retry-After` header                                                                     |

Requests without an `Origin` header are not blocked by the Origin check.

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

_Last updated by TB03._
