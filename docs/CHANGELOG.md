# Changelog

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
- Security: `react-router-dom` bumped to `^6.30.6` to clear a high-severity advisory.
