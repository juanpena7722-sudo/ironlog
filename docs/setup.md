# Setup

## Requirements

Node.js 26 and npm for the frontend. The backend also needs Docker with Compose v2 for PostgreSQL.

## Install and run

```bash
npm ci
npm run dev
```

## Scripts

| Script                  | What it does                                                                                    |
| ----------------------- | ----------------------------------------------------------------------------------------------- |
| `npm run dev`           | Starts the Vite dev server; requests under `/api` are proxied to `http://localhost:3000`.       |
| `npm run build`         | Type-checks (`tsc -b`) and builds to `dist/`.                                                   |
| `npm run preview`       | Serves the built `dist/` locally.                                                               |
| `npm run lint`          | Runs ESLint on the repo (`eslint-config-prettier` turns off rules that conflict with Prettier). |
| `npm run format`        | Formats every file with Prettier.                                                               |
| `npm run format:check`  | Fails if any file is not Prettier-formatted.                                                    |
| `npm run typecheck`     | Runs `tsc -b --noEmit` across the app, `shared/` and config.                                    |
| `npm test`              | Runs the Vitest suite once.                                                                     |
| `npm run test:coverage` | Runs Vitest with v8 coverage and enforces the thresholds.                                       |

Prettier settings are in `.prettierrc.json`; ignored paths are in `.prettierignore`.

## Backend

The API is a separate package in `server/` with its own lockfile.

```bash
docker compose up -d postgres
npm --prefix server ci
cp server/.env.example server/.env   # then set JWT_SECRET
npm --prefix server run db:migrate
npm --prefix server run dev
```

`npm --prefix server ci` also runs `prisma generate` (`postinstall`), which writes the Prisma
client to `server/src/generated/prisma` (git-ignored).

The server listens on `http://127.0.0.1:3000` (`GET /api/v1/health` returns `{"status":"ok"}`).
Outside production, `GET /docs` returns the OpenAPI JSON document.

### argon2 and glibc

Password hashing uses the native `argon2` package, pinned to `^0.41.1` in
`server/package.json`. It loads a prebuilt binary from `node_modules/argon2/prebuilds/`, so no
compiler is needed. Releases from 0.42 on need a newer glibc than 2.28, which the development
machine runs, so do not upgrade past 0.41 until every machine that installs the server has a newer
glibc. Check the version with `ldd --version`.

### Database (Docker Compose)

`docker-compose.yml` defines one service, `postgres` (`postgres:16`):

| Setting   | Value                                                                   |
| --------- | ----------------------------------------------------------------------- |
| User      | `ironlog` / password `ironlog`                                          |
| Databases | `ironlog_dev` (`POSTGRES_DB`) and `ironlog_test` (`server/db/init.sql`) |
| Port      | `127.0.0.1:5432` (local only)                                           |
| Volume    | `postgres-data`                                                         |

`server/db/init.sql` runs only when the volume is first created. To recreate both databases from
scratch, run `docker compose down -v` and then `docker compose up -d postgres`.

```bash
docker compose up -d postgres   # start
docker compose down             # stop (keeps data)
docker compose down -v          # stop and delete data
```

### Server scripts

Run with `npm --prefix server run <script>` or from inside `server/`.

| Script            | What it does                                                                                       |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| `dev`             | Starts `src/server.ts` with `tsx watch`, loading `server/.env`.                                    |
| `build`           | Bundles `src/server.ts` with tsup to `server/dist/server.js` (ESM).                                |
| `start`           | Runs `node dist/server.js`. Env vars must be set in the environment.                               |
| `lint`            | Runs ESLint with `server/eslint.config.js`.                                                        |
| `typecheck`       | Runs `tsc --noEmit`.                                                                               |
| `test`            | Runs the Vitest suite once.                                                                        |
| `test:coverage`   | Runs Vitest with v8 coverage and enforces the thresholds.                                          |
| `postinstall`     | Runs `prisma generate` after `npm ci` / `npm install`.                                             |
| `db:migrate`      | Runs `prisma migrate dev` against `DATABASE_URL` (from `server/.env`).                             |
| `db:migrate:test` | Runs `prisma migrate deploy` against `ironlog_test`.                                               |
| `db:reset:test`   | Runs `prisma migrate reset --force` against `ironlog_test` (drops all data, reapplies migrations). |
| `db:seed`         | Runs `prisma db seed` (`tsx prisma/seed.ts`) against `DATABASE_URL`.                               |

### Database scripts

Prisma reads its settings from `server/prisma.config.ts`, which loads `server/.env` when it
exists. `db:migrate:test` and `db:reset:test` set their own `DATABASE_URL`
(`postgresql://ironlog:ironlog@localhost:5432/ironlog_test`).

```bash
npm --prefix server run db:migrate        # dev database: apply migrations, create new ones
npm --prefix server run db:migrate:test   # test database: apply committed migrations
npm --prefix server run db:reset:test     # test database: drop everything and reapply
npm --prefix server run db:seed           # load the demo user into DATABASE_URL
```

`db:seed` needs the full server env (`NODE_ENV`, `DATABASE_URL`, `JWT_SECRET`) and a migrated
database. It deletes the user `demo@ironlog.local` if present, then creates it again with goals,
workouts, food, body and health entries from `makeDemoData()` in `src/demo.ts`. Running it twice
leaves one demo user. The demo user's `passwordHash` is an empty placeholder, so it cannot log
in. The seed runs under tsx and is not part of the server `typecheck`.

`db:reset:test` is destructive. Prisma 7 refuses to run `migrate reset` when it detects that an
AI agent invoked it, so only the owner runs this script.

## Production stack

The production stack (gateway, API and database; see [`architecture.md`](./architecture.md))
needs Docker with Compose v2. Run it from the repo root:

```bash
cp .env.example .env            # then set POSTGRES_PASSWORD and JWT_SECRET
npm ci && npm run build         # the gateway serves ./dist, so build it first
docker compose -f docker-compose.prod.yml up -d --build --wait
```

Compose reads `.env` in the repo root. `POSTGRES_PASSWORD` and `JWT_SECRET` are required: if
either is unset or empty, Compose stops with an error before starting anything. The API applies
pending migrations on start.

| Command                                              | What it does                                             |
| ---------------------------------------------------- | -------------------------------------------------------- |
| `docker compose -f docker-compose.prod.yml ps`       | Shows the services and their health.                     |
| `docker compose -f docker-compose.prod.yml logs api` | Shows the API logs (JSON, secrets redacted).             |
| `docker compose -f docker-compose.prod.yml down`     | Stops the stack and keeps the data.                      |
| `docker compose -f docker-compose.prod.yml down -v`  | Stops the stack and deletes the database and Caddy data. |

Only the gateway publishes ports (`80` and `443`). Check the stack with:

```bash
curl -i http://localhost/                # 200, the app
curl -i http://localhost/api/v1/health   # 200, {"status":"ok"} through the gateway
```

The production stack and the development `postgres` service use different Compose projects
(`ironlog-prod` and the repo directory name) and different volumes, so they do not share data.

## Path alias

`@shared/*` resolves to `shared/*`. It is defined in `vite.config.ts` (`resolve.alias`) and in
`tsconfig.app.json` (`paths`).

## Environment variables

The frontend uses none.

The production stack reads these from `.env` in the repo root (template in the root
`.env.example`):

| Variable            | Required | Example / default                                                                                       |
| ------------------- | -------- | ------------------------------------------------------------------------------------------------------- |
| `POSTGRES_PASSWORD` | Yes      | URL-safe characters only, because it is placed in the API's `DATABASE_URL`; e.g. `openssl rand -hex 24` |
| `JWT_SECRET`        | Yes      | At least 32 characters, e.g. `openssl rand -base64 48`                                                  |
| `SITE_ADDRESS`      | No       | `:80` (default, plain HTTP); a domain name such as `ironlog.example.com` turns on automatic HTTPS       |

Inside the stack, the API gets `NODE_ENV=production`, `PORT=3000` and
`DATABASE_URL=postgresql://ironlog:<POSTGRES_PASSWORD>@db:5432/ironlog`.

The backend reads these from the environment (`server/.env` in development; template in
`server/.env.example`). Startup fails if any is invalid.

| Variable       | Required | Example / default                                         |
| -------------- | -------- | --------------------------------------------------------- |
| `NODE_ENV`     | Yes      | `development`, `test` or `production`                     |
| `PORT`         | No       | `3000` (default)                                          |
| `DATABASE_URL` | Yes      | `postgresql://ironlog:ironlog@localhost:5432/ironlog_dev` |
| `JWT_SECRET`   | Yes      | At least 32 characters, e.g. `openssl rand -base64 48`    |

`.env` and `.env.*` (except `.env.example`) are git-ignored in every directory.

## Continuous integration

`.github/workflows/ci.yml` runs on every push and pull request, on Node.js 26, with two jobs.

The frontend job runs at the repo root:

```bash
npm ci
npm run lint
npm run format:check
npm run typecheck
npm run test:coverage
npm run build
npm audit --omit=dev --audit-level=high
```

The `backend` job runs in `server/` with a `postgres:16` service (database `ironlog_test`) and
`NODE_ENV=test`, `DATABASE_URL`, `JWT_SECRET` set in the job env:

```bash
npm ci
npm run lint
npm run typecheck
npm run db:migrate:test
npm run test:coverage
npm run build
npm audit --omit=dev --audit-level=high
```

The audit steps fail only on high or critical advisories in production dependencies.

_Last updated by TF02._
