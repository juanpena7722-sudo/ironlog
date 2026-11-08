# IronLog Documentation

Maintained by Agent 2 (Release) after all tests for a task pass, in the same pull request as
the task (see [`PRODUCTION_RULES.md`](../PRODUCTION_RULES.md) §8).

## Structure

| File              | Contents                                                   | Created by the first task that…   |
| ----------------- | ---------------------------------------------------------- | --------------------------------- |
| `architecture.md` | System overview, gateway, data flow, key decisions         | adds a new system component       |
| `frontend.md`     | Pages, data layer, shared components, frontend conventions | changes frontend structure        |
| `backend.md`      | Modules, auth, data model, configuration                   | adds backend code                 |
| `api.md`          | Endpoint reference                                         | adds or changes an endpoint       |
| `setup.md`        | Local setup, env vars, scripts, deployment                 | adds a script, env var or service |
| `testing.md`      | Test types, how to run them, coverage                      | adds test tooling                 |
| `CHANGELOG.md`    | One entry per task, newest first                           | first task                        |
| `tasks/<ID>.md`   | Record of one task                                         | every task                        |

## Writing rules

- Describe what exists now. No plans, no placeholders, no sections for unbuilt features.
- Update only what the task changed; delete anything the task made stale.
- Use the exact names from code (files, functions, routes, env vars, scripts).
- Short sentences, tables for reference data, fenced code for commands.
- No AI attribution.

## Templates

### `tasks/<ID>.md`

```markdown
# <ID> — <title>

- **Status:** Verified, PR #<n> awaiting owner approval
- **Branch:** <branch>
- **Date:** <yyyy-mm-dd>

## Summary
<What was built and why, 2–5 lines.>

## Changes
| File | Change |
|---|---|

## Acceptance criteria
| # | Expected result | Test | Result |
|---|---|---|---|

## Validation
<Gate table from the Validation Report.>

## Notes
<Decisions, known limitations, follow-ups. "None" if none.>
```

### `CHANGELOG.md` entry

```markdown
## <ID> — <title> (<yyyy-mm-dd>)
- Added: …
- Changed: …
- Fixed: …
- Security: …
```

### `api.md` endpoint entry

```markdown
### <METHOD> /api/v1/<path>
Auth: required | none

**Request**
| Field | Type | Rules |
|---|---|---|

**Responses**
| Status | Body |
|---|---|
| 200 | <shape> |
| 400 | Problem Details with `errors` |
| 401 | Problem Details |
```

### Section-based files (`architecture.md`, `frontend.md`, `backend.md`, `setup.md`, `testing.md`)

```markdown
# <Title>

## <Topic>
<Current state, in plain language.>

_Last updated by <ID>._
```
