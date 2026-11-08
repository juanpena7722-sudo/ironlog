# Changelog

## TB01 — Server scaffold (2026-11-08)

- Added: `server/` package (Fastify 5, ESM, Node.js 26, strict TypeScript) with ESLint, Vitest,
  tsx and tsup; scripts `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:coverage`.
- Added: `server/src/env.ts`, which validates `NODE_ENV`, `PORT` (default 3000), `DATABASE_URL`
  and `JWT_SECRET` (at least 32 characters) with Zod. Invalid env stops startup.
- Added: `buildApp()` in `server/src/app.ts` with `@fastify/sensible` and a global error handler
  that returns RFC 9457 Problem Details (400 with `errors`, 404, 4xx `httpErrors`, 500).
- Added: `GET /api/v1/health` returns `{ "status": "ok" }`.
- Added: `docker-compose.yml` with `postgres:16` (`ironlog_dev`, plus `ironlog_test` via
  `server/db/init.sql`); `server/.env.example`.
- Added: `backend` CI job with a PostgreSQL service.
- Changed: root `eslint.config.js` ignores `server/`, which has its own ESLint config.
- Security: the server listens on `127.0.0.1` only; 500 responses hide internal messages
  outside `development`; Postgres is published on `127.0.0.1` only.

## TF00 — Foundation: tooling, shared schemas, CI (2026-11-08)

- Added: Prettier and `eslint-config-prettier`; scripts `format`, `format:check`, `typecheck`,
  `test`, `test:coverage`.
- Added: Vitest with v8 coverage and thresholds (80/75 overall, 90/85 for `shared/**`).
- Added: `shared/schemas.ts` with Zod schemas for every data type, and `shared/schemas.test.ts`.
- Added: `@shared/*` alias in Vite and TypeScript.
- Added: GitHub Actions workflow `.github/workflows/ci.yml`.
- Added: `.env.example`; `.gitignore` entries for `.env`, `coverage`, `playwright-report`,
  `test-results`.
- Changed: `src/types.ts` re-exports the types inferred from `shared/schemas.ts`.
- Changed: all existing files reformatted with Prettier (no behaviour change).
- Removed: comments that restated the code, scaffold comments, unused exports.
- Security: `react-router-dom` bumped to `^6.30.6` to clear a high-severity advisory.
