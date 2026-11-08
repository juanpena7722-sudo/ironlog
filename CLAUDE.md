# IronLog — Claude instructions

- Rules for building, testing and shipping: [`PRODUCTION_RULES.md`](./PRODUCTION_RULES.md) (source of truth).
- Work backlog, split into Frontend and Backend tasks: [`TASKS.md`](./TASKS.md).

## How to run a task

Use the two agents defined in `.claude/agents/`, in this order, one task at a time:

1. `builder` — implements the next ready task and returns a Handoff Report. Never pushes.
2. `release` — runs every test and the rules checklist; on failure sends a Failure Report back
   to `builder`; on success pushes, opens a PR, waits for CI and merges.
   Repeat the builder ↔ release loop until the task merges (escalate to the human after 3 failed cycles).
