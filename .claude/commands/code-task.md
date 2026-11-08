---
description: Run one IronLog task (tfNN frontend, tbNN backend) through Agent 1 (build) and Agent 2 (test, document, PR).
argument-hint: <task-id e.g. tf01 | tb03>
---

Run task `$ARGUMENTS` under `PRODUCTION_RULES.md`.

1. Normalise the ID to uppercase. It must match `^(TF|TB)\d{2,}$`; otherwise stop and show the valid format.
2. Find `### [<status>] <ID>` in `TASKS.md`. If it is missing, stop. If any **Depends on** task is not
   merged into `main`, stop and list the missing ones.
3. If the task's branch already exists locally, resume: skip to step 5 if its status is `[?]`.
4. Launch the `builder` agent with the task ID. If it returns a question for the owner, stop and relay it.
5. Launch the `release` agent with the task ID, the branch and the Handoff Report.
6. If Agent 2 returns a Failure Report, send it to the `builder` agent, then repeat step 5. Stop after 3 failed cycles and report.
7. Report to the owner: the PR URL, the CI result and a one-line summary. Do not merge, and do not start another task.
