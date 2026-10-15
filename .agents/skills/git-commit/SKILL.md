---
name: git-commit
description:
  Use when committing changes in this repository - grouping work into atomic commits, staging
  explicit paths, running the commit gate, and writing commitlint-conformant English messages.
---

# Git commit

Commit local work as one or more atomic, individually verified commits on the current branch. Never
push, merge, amend, rebase, reset, check out, switch, restore, clean, stash, tag, create branches or
worktrees, or bypass hooks (`--no-verify`, `-n`, `HUSKY=0`, `core.hooksPath`). The owner reviews the
commits and pushes.

Run every command from the repository root without a `cd` prefix (a `cd` defeats the path-based
permission rules).

## 1. Know what is yours

1. `git status --porcelain`. If it lists changes you did not make in this session, stop and report
   them: you must never commit the owner's unrelated work.
2. List the exact paths you intend to commit. Never stage with `git add -A`, `git add .`,
   `git add -u`, a directory or a glob.

## 2. Read the message rules

Read `commitlint.config.mjs` (extends `@commitlint/config-conventional`): allowed types
`feat fix docs style refactor perf test build ci chore revert`, lower-case type, no empty subject,
no trailing period, header and body lines at most 100 characters. If the config changes, the file
wins over this summary.

## 3. Group into commits

- One logical change per commit; each commit leaves the codebase working.
- Commit foundations before dependents: if B imports A, A goes first (types and utilities → services
  → queries/mutations/routes → components → configuration → tests → docs). Tests and the spec edit
  usually belong in the same commit as the code they cover.
- Lockfiles, generated files and formatting-only edits never get their own commit; they ride with
  the code that caused them.
- A task from `openspec/changes/<name>/tasks.md` is exactly one commit, including its checkbox tick.

## 4. Commit gate (before each commit)

Run and read the output of:

1. `pnpm lint` (this also warms the ESLint cache the pre-commit hook reuses);
2. `pnpm typecheck`;
3. the tests covering the touched area: `pnpm exec vitest run <test files>` or
   `pnpm exec vitest related --run <changed source files>`; `pnpm test` before declaring a change
   finished.

A failing or skipped check is not a pass. Fix the cause before committing.

## 5. Stage and prove it

```bash
git add -- <path> <path> ...
git diff --cached --name-only
```

The second command's output must equal your list from step 1. If it does not, do not commit and do
not try to unstage with `reset` or `restore`: report the difference and stop.

## 6. Write the message

```text
<type>(<scope>): <imperative subject, lower-case start, no period>

<optional body: why, when the subject cannot say it>
Change: <change-name>, task <n>
```

- Scope is the capability or area (`invoicing`, `rules`, `openspec`).
- The `Change:` body line is required for commits that complete a task of an `openspec` change;
  `next-step` finds tasks by it. It is body text, not a trailer.
- English only. No co-author lines, AI credits, `Co-Authored-By` or other trailers, and no mention
  that the commit was generated.

Commit with `git commit -F -` and a heredoc, or `-m` for a one-line message.

## 7. When a hook fails

The pre-commit hook runs lint-staged (ESLint `--fix` + Prettier on staged files) and the oxlint
cycle check; commit-msg runs commitlint. On failure the commit does not exist, so there is nothing
to amend: read the output, fix the cause, re-stage the same paths, re-run step 5, commit again. If
it fails a second time on something outside your paths, stop and report it.

## 8. Report

```text
Committed 2:
1. <hash> feat(invoicing): add credit balance to the client summary
2. <hash> test(invoicing): cover credit balance rounding
Staged exactly: <paths>
```
