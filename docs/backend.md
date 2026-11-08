# Backend

## Package

The API lives in `server/`, a separate npm package (`ironlog-server`) with its own
`package.json`, lockfile, ESLint config (`server/eslint.config.js`) and `tsconfig.json`. It is
ESM, runs on Node.js 26 and uses Fastify 5 with TypeScript `strict`. The root ESLint config
ignores `server/`; root Prettier formats it.

## Modules

| File                   | Purpose                                                                                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `server/src/env.ts`    | `parseEnv(source)` validates environment variables with Zod and returns a typed `Env`. It throws on invalid input.                                  |
| `server/src/app.ts`    | `buildApp(env)` creates the Fastify instance: registers `@fastify/sensible`, the 404 and global error handlers, and the routes. It does not listen. |
| `server/src/server.ts` | Entry point. Parses `process.env`, builds the app and listens on `127.0.0.1:<PORT>`.                                                                |

Tests call `buildApp()` and use `app.inject()`, so no port is opened.

The server binds to `127.0.0.1` only. It is never exposed publicly; browser traffic reaches it
through the gateway (PRODUCTION_RULES §3.4).

Logging uses Fastify's built-in pino logger at level `info`, or `silent` when `NODE_ENV=test`.

## Configuration

`parseEnv()` validates these variables at startup. If any is missing or invalid, it throws and
the process exits with a non-zero code before listening.

| Variable       | Rules                                      | Default |
| -------------- | ------------------------------------------ | ------- |
| `NODE_ENV`     | `development`, `test` or `production`      | none    |
| `PORT`         | Integer 1–65535                            | `3000`  |
| `DATABASE_URL` | A valid URL (PostgreSQL connection string) | none    |
| `JWT_SECRET`   | String of at least 32 characters           | none    |

`DATABASE_URL` and `JWT_SECRET` are validated but not used by any module yet.

## Error handling

Every error response is RFC 9457 Problem Details, sent with
`Content-Type: application/problem+json` (format in [`api.md`](./api.md#errors)). Only standard
HTTP status codes are used.

| Source                                                                            | Status           | `detail`                                                                     |
| --------------------------------------------------------------------------------- | ---------------- | ---------------------------------------------------------------------------- |
| A thrown `ZodError`                                                               | 400              | `Invalid input`, plus `errors: [{ path, message }]` (path joined with `.`)   |
| Unknown route (`setNotFoundHandler`)                                              | 404              | `Route <METHOD> <url> not found`                                             |
| `app.httpErrors.*` from `@fastify/sensible`, or any error with a 4xx `statusCode` | That status      | The error message                                                            |
| Any other error (or a 5xx `statusCode`)                                           | 500 (or the 5xx) | The error message in `development`; `An unexpected error occurred` otherwise |

`title` is the standard reason phrase for the status (from `node:http` `STATUS_CODES`). 5xx
errors are logged with `request.log.error`. Stack traces and internal messages never reach the
response outside `development`.

Route handlers throw `app.httpErrors.<name>(detail)` for expected failures (for example
`app.httpErrors.conflict('Email already registered')`) and let the global handler format them.

_Last updated by TB01._
