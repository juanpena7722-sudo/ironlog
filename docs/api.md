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

## Endpoints

### GET /api/v1/health

Auth: none

Liveness check.

**Responses**

| Status | Body                 |
| ------ | -------------------- |
| 200    | `{ "status": "ok" }` |

_Last updated by TB01._
