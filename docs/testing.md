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

Coverage uses the v8 provider and writes `text`, `html` and `lcov` reports to `coverage/`
(git-ignored).

| Scope       | Lines | Branches |
| ----------- | ----- | -------- |
| Overall     | 80 %  | 75 %     |
| `shared/**` | 90 %  | 85 %     |

Only `shared/**/*.ts` (excluding test files) is measured for now. `src/` is not yet included in
coverage.

_Last updated by TF00._
