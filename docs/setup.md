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
| `npm run dev`           | Starts the Vite dev server.                                                                     |
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
npm --prefix server run dev
```

The server listens on `http://127.0.0.1:3000` (`GET /api/v1/health` returns `{"status":"ok"}`).

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

| Script          | What it does                                                         |
| --------------- | -------------------------------------------------------------------- |
| `dev`           | Starts `src/server.ts` with `tsx watch`, loading `server/.env`.      |
| `build`         | Bundles `src/server.ts` with tsup to `server/dist/server.js` (ESM).  |
| `start`         | Runs `node dist/server.js`. Env vars must be set in the environment. |
| `lint`          | Runs ESLint with `server/eslint.config.js`.                          |
| `typecheck`     | Runs `tsc --noEmit`.                                                 |
| `test`          | Runs the Vitest suite once.                                          |
| `test:coverage` | Runs Vitest with v8 coverage and enforces the thresholds.            |

## Path alias

`@shared/*` resolves to `shared/*`. It is defined in `vite.config.ts` (`resolve.alias`) and in
`tsconfig.app.json` (`paths`).

## Environment variables

The frontend uses none; the root `.env.example` is empty.

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
npm run test:coverage
npm run build
npm audit --omit=dev --audit-level=high
```

The audit steps fail only on high or critical advisories in production dependencies.

_Last updated by TB01._
