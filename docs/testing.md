# Testing

## Unit tests

Vitest runs tests matching `shared/**/*.test.ts` and `src/**/*.test.{ts,tsx}` (configured in
`vite.config.ts`, `test.include`).

```bash
npm test               # run once
npm run test:coverage  # run with coverage and thresholds
```

| File                     | Covers                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------- |
| `shared/schemas.test.ts` | Valid and invalid cases for every Zod schema in `shared/schemas.ts`, plus the exported constants. |

## Coverage

Coverage uses the v8 provider and writes `text` and `html` reports to `coverage/`
(git-ignored).

| Scope       | Lines | Branches |
| ----------- | ----- | -------- |
| Overall     | 80 %  | 75 %     |
| `shared/**` | 90 %  | 85 %     |

Only `shared/**/*.ts` (excluding test files) is measured for now. `src/` is not yet included in
coverage.

## Backend tests

The server has its own Vitest config, `server/vitest.config.ts`, which runs `server/src/**/*.test.ts`.
API tests call `buildApp()` and send requests with `app.inject()`; no port is opened.

```bash
npm --prefix server test               # run once
npm --prefix server run test:coverage  # run with coverage and thresholds
```

| File                     | Covers                                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `server/src/app.test.ts` | Health 200; 404, 400 (Zod, with `errors`), 409 (`httpErrors`) and 500 Problem Details; 500 hides internals in production. |
| `server/src/env.test.ts` | Valid env with `PORT` default 3000; rejects a `JWT_SECRET` shorter than 32 characters.                                    |

Coverage measures `server/src/**/*.ts` except test files and `src/server.ts` (the entry point),
with thresholds of 90 % lines and 85 % branches. Reports go to `server/coverage/` (git-ignored).

_Last updated by TB01._
