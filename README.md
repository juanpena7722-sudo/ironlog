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
npm run dev     # start dev server
npm run build   # type-check and build to dist/
```

Built with Vite, React, TypeScript and Recharts.
