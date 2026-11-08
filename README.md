# IronLog

A web app for bodybuilders to track workouts, diet, body progress and health.

## Features

- **Dashboard:** today's macros vs targets, bodyweight trend, sets per muscle group this week, recent sessions
- **Workouts:** log sets, weight and reps; repeat or edit past sessions; estimated-1RM personal records; weekly volume
- **Diet:** per-meal food log, calories from macros, quick re-add, 14-day calorie chart
- **Progress:** weigh-ins, body fat and measurements with trend charts
- **Health:** sleep, water, resting HR, steps, energy and notes
- **Settings:** targets, kg/lb units, macro suggestions, JSON backup export/import, demo data

All data is stored locally in the browser (localStorage).

## Development

```bash
npm install
npm run dev            # start dev server
npm run build          # type-check and build to dist/
npm run lint           # ESLint
npm run format         # format all files with Prettier (format:check to verify only)
npm run typecheck      # TypeScript project check, including shared/
npm test               # Vitest unit tests
npm run test:coverage  # tests with coverage thresholds enforced
```

Data shapes are defined once as Zod schemas in `shared/schemas.ts` (imported via the
`@shared/*` alias); `src/types.ts` re-exports the inferred types. CI
(`.github/workflows/ci.yml`) runs lint, format check, typecheck, coverage and build on every
push and pull request.

Built with Vite, React, TypeScript and Recharts.
