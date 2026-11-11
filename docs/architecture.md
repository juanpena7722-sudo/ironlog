# Architecture

## Overview

IronLog has three runtime parts:

| Part     | What it is                                                      | Source               |
| -------- | --------------------------------------------------------------- | -------------------- |
| Frontend | React single-page app, built by Vite to static files in `dist/` | `src/`, `shared/`    |
| API      | Fastify server (`ironlog-server`), JSON under `/api/v1`         | `server/`, `shared/` |
| Database | PostgreSQL 16, accessed only by the API through Prisma          | `server/prisma/`     |

The browser talks to one origin only. In production that origin is the gateway; the API and
the database are never reachable from outside (PRODUCTION_RULES §3.4).

```
browser ──HTTPS──▶ gateway (Caddy, ports 80/443)
                     ├─ /api/v1/*  ──▶ api:3000 ──▶ db:5432
                     └─ everything else ──▶ dist/ (SPA fallback to index.html)
```

## Gateway

`deploy/Caddyfile` configures Caddy 2:

| Setting          | Value                                                                                                                                                                                                                                                                                               |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Site address     | `SITE_ADDRESS`, default `:80` (plain HTTP). A domain name turns on Caddy's automatic HTTPS                                                                                                                                                                                                          |
| `/api/v1/*`      | `reverse_proxy api:3000`                                                                                                                                                                                                                                                                            |
| Everything else  | Static files from `/srv` (the bind-mounted `dist/`); unknown paths serve `/index.html` (SPA fallback)                                                                                                                                                                                               |
| Compression      | `zstd`, `gzip`                                                                                                                                                                                                                                                                                      |
| Admin API        | Off                                                                                                                                                                                                                                                                                                 |
| Security headers | `Content-Security-Policy` (`default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`), `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`; the `Server` header is removed |

The gateway sets these headers on every response, including proxied API responses, where they
overwrite the values from `@fastify/helmet`. Paths outside `/api/v1/*`, such as `/docs`, are
served by the SPA fallback and never reach the API.

In development there is no gateway: the Vite dev server serves the frontend and proxies `/api`
to the API on `http://localhost:3000` (see [`frontend.md`](./frontend.md#development-proxy)).

## Production stack

`docker-compose.prod.yml` (Compose project `ironlog-prod`) runs the three parts:

| Service   | Image                          | Networks             | Published ports | Health check                        |
| --------- | ------------------------------ | -------------------- | --------------- | ----------------------------------- |
| `gateway` | `caddy:2-alpine`               | `public`, `internal` | `80`, `443`     | none; starts after `api` is healthy |
| `api`     | Built from `server/Dockerfile` | `internal`           | none            | `GET /api/v1/health`                |
| `db`      | `postgres:16`                  | `internal`           | none            | `pg_isready`                        |

The `internal` network is declared `internal: true`, so its containers have no route to the
outside. Only the gateway joins both networks. Data lives in the `db-data` volume; Caddy's
certificates and state live in `caddy-data`. Every service restarts `unless-stopped`.

### API image

`server/Dockerfile` is a two-stage build on `node:26-alpine`. Its build context is the
repository root, because the server imports `../shared`; the root `.dockerignore` keeps
`node_modules`, `dist`, `.git`, coverage, test output and `.env` files out of the context.

1. Build stage: installs the server dependencies, runs `prisma generate` and `npm run build`
   (`server/dist/server.js`), then prunes dev dependencies.
2. Runtime stage: copies `package.json`, `prisma.config.ts`, `prisma/`, `node_modules/` and
   `dist/`, sets `NODE_ENV=production` and runs as the non-root `node` user.

On start the container runs `prisma migrate deploy` and then `node dist/server.js` (with `exec`,
so the server receives `SIGTERM` directly and shuts down gracefully). `prisma` is a runtime
dependency for this reason.

## Key decisions

- **Single origin.** CORS is disabled; the frontend never knows the API's internal address.
- **Frontend served from the host.** The gateway bind-mounts `./dist`, so `npm run build` must
  run before the stack starts, and a rebuild is picked up without rebuilding any image.
- **`trustProxy` in production only.** The API trusts `X-Forwarded-For` only when it runs behind
  the gateway, so rate limits count the real client IP.

_Last updated by TF02._
