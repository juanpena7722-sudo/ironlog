# Setup

## Requirements

Node.js 26 and npm. No services or databases are needed yet.

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

## Path alias

`@shared/*` resolves to `shared/*`. It is defined in `vite.config.ts` (`resolve.alias`) and in
`tsconfig.app.json` (`paths`).

## Environment variables

None are used yet. `.env.example` is committed empty; copy it to `.env` when variables are added.
`.env` and `.env.*` (except `.env.example`) are git-ignored.

## Continuous integration

`.github/workflows/ci.yml` runs on every push and pull request, on Node.js 26:

```bash
npm ci
npm run lint
npm run format:check
npm run typecheck
npm run test:coverage
npm run build
npm audit --omit=dev --audit-level=high
```

The audit step fails only on high or critical advisories in production dependencies.

_Last updated by TF00._
