---
name: implement-task
description:
  Use when executing tasks from an approved openspec change task list - runs each task in a fresh
  implementer agent, has a reviewer check it, and lands one verified commit per task.
---

# Implement a task

Input: the first unticked task in `openspec/changes/<name>/tasks.md`, with Gate 1 approved and Gate
2 approved or not applicable. One task at a time; never batch tasks into one commit.

## 1. Brief the implementer

Dispatch the `implementer` agent with a self-contained brief (it has no memory of this
conversation):

- the change name, task number and the task text verbatim;
- the paths of the proposal, the design (if any) and the capability spec;
- the rules that match the files it will touch (`AGENTS.md` table);
- the commit body line it must use: `Change: <name>, task <n>`.

Without a subagent tool, do the implementer's work yourself, following
`.agents/agents/implementer.md`.

## 2. Check the report against evidence

The implementer returns a commit hash, the staged path list and the commands it ran. Confirm:

- `git show --stat <hash>` matches the reported paths and nothing else;
- the commit body has the `Change:` line and the task box is ticked in that commit;
- `git status --porcelain` is clean.

## 3. Review

Dispatch the `reviewer` agent with the change name, task number and commit hash. It returns two
verdicts — spec compliance and quality — and findings.

- Both pass → go to step 4.
- Findings → send them to a fresh `implementer` as a follow-up task in the same change; the fix is a
  new commit (never amend). Review again. After three failed rounds, stop and report to the owner.

## 4. Next

If unticked tasks remain, repeat from step 1 with the next task. When all are ticked, run
`finish-change`.

Stop and ask the owner when the task cannot be done as written, needs scope beyond the proposal, or
the code contradicts the spec.
