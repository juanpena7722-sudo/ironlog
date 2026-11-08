# IronLog

- Rules: [`PRODUCTION_RULES.md`](./PRODUCTION_RULES.md). Tasks: [`TASKS.md`](./TASKS.md). Docs: [`docs/`](./docs/README.md).
- Start a task only when the owner runs `/code-task <id>` (`tfNN` frontend, `tbNN` backend). Never start, chain or merge tasks on your own.
- Agent 1 (`builder`) implements; Agent 2 (`release`) tests, documents and opens the PR. The owner authorizes every merge.
- Change only files the task requires; ask the owner before touching any other file.
- No AI attribution in code, comments, commits, PRs or docs.
