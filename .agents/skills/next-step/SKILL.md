---
name: next-step
description:
  Use when asked to continue, resume, pick up where work stopped, or decide what to do next - checks
  the recorded state against git and the code, then names the next action.
---

# Next step

Find the next piece of work from the one source of state, after proving that state true. A ticked
box is a claim, not evidence; code, tests and `git log` are the only sources that cannot be stale.

## 1. Clean start

`git status --porcelain`. If anything is modified or untracked that you did not create in this
session, stop and report it. Never commit or discard work you cannot attribute.

## 2. Read the state

- `openspec/backlog.md` — the ordered Next list and the Gaps table.
- Every folder in `openspec/changes/` — its `proposal.md` (Gate 1 line) and `tasks.md`.

## 3. Verify active changes against git and code

For each change folder:

1. Every ticked task must have a commit: `git log --oneline --grep "Change: <name>, task <n>"`.
   Missing → report "task <n> ticked without a commit" and stop.
2. Re-run the `Verify:` command of the last ticked task. Failing → report it and stop.
3. Spot-check that what the last ticked task claims exists in the code (the files, the exported
   function, the test). Referencing a decision is not implementing it.

## 4. Choose

In order, the first that applies:

1. A change with `Gate 1: pending` → it waits for the owner; report what the owner must decide.
2. A change with approved scope and no `tasks.md` tasks → `plan-change`.
3. A change with unticked tasks → `implement-task` on the first unticked task.
4. A change with every task ticked and its folder still present → `finish-change`.
5. The first entry of `backlog.md` Next → `quick-change` if it meets every quick-path criterion in
   that skill, otherwise `propose-change`.
6. Nothing left → report that the backlog is empty.

## 5. Stop and ask instead of guessing when

- two candidates are equally next, or a change folder is not in the backlog;
- the code contradicts a spec, a ticked task or the backlog;
- the next step needs an owner decision (scope, UI, a standing owner decision in `AGENTS.md`);
- the work would grow beyond the change's approved scope.

## 6. Report

```text
State: <verified | mismatch: ...>
Next: <skill> on <change or backlog entry> — <one line why>
Owner input needed: <none | question with the recommended answer>
```

Then run the chosen skill unless the owner asked only for the report.
