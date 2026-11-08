# IronLog

A web app for bodybuilders to track workouts, diet, body progress and health.

## Features

- **Dashboard:** today's macros vs targets, bodyweight trend, sets per muscle group this week, recent sessions
- **Workouts:** log sets, weight and reps; repeat or edit past sessions; estimated-1RM personal records; weekly volume
- **Diet:** per-meal food log, calories from macros, quick re-add, 14-day calorie chart
- **Progress:** weigh-ins, body fat and measurements with trend charts
- **Health:** sleep, water, resting HR, steps, energy and notes
- **Settings:** targets, kg/lb units, macro suggestions, JSON backup export/import, demo data

All data is currently stored locally in the browser (localStorage).

## Tech stack

Frontend: Vite, React 19, TypeScript, React Router, Recharts and Zod. Backend (in progress):
Fastify 5, Zod and PostgreSQL 16 (Docker Compose). Tooling: ESLint, Prettier, Vitest and GitHub
Actions.

## Getting started

Requires Node.js 26.

```bash
npm ci
npm run dev
```

The backend (`server/`) also needs Docker:

```bash
docker compose up -d postgres
npm --prefix server ci
cp server/.env.example server/.env   # then set JWT_SECRET
npm --prefix server run dev
```

See [`docs/setup.md`](./docs/setup.md) for env vars and server scripts.

## Scripts

| Script                  | What it does                                |
| ----------------------- | ------------------------------------------- |
| `npm run dev`           | Start the dev server                        |
| `npm run build`         | Type-check and build to `dist/`             |
| `npm run preview`       | Serve the built app                         |
| `npm run lint`          | ESLint                                      |
| `npm run format`        | Format all files with Prettier              |
| `npm run format:check`  | Verify formatting                           |
| `npm run typecheck`     | TypeScript check, including `shared/`       |
| `npm test`              | Run unit tests                              |
| `npm run test:coverage` | Run tests with coverage thresholds enforced |

CI (`.github/workflows/ci.yml`) runs lint, format check, typecheck, coverage, build and
`npm audit` on every push and pull request, with a separate job for `server/`.

## Project structure

```
src/        React app (pages, components, store, utils)
shared/     Zod schemas and the data types inferred from them (@shared/* alias)
server/     Fastify API (separate npm package)
docs/       Project documentation
```

## Documentation

- [`docs/`](./docs/README.md): setup, backend, API, testing, changelog and task records
- [`PRODUCTION_RULES.md`](./PRODUCTION_RULES.md): development, testing, security and release rules
- [`TASKS.md`](./TASKS.md): frontend (`TF`) and backend (`TB`) task backlog
