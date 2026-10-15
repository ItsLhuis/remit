---
name: quick-change
description:
  Use when asked for a small, self-contained fix or tweak - a typo, a copy change, a bug fix that
  restores specified behaviour, a config or guidance edit - that fits one reviewed commit.
---

# Quick change

One commit, no change folder. Use it only when every criterion holds; otherwise switch to
`propose-change`.

## 1. Quick-path criteria (all must hold)

1. No requirement in `openspec/specs/**` is added, changed or removed. A fix that restores what a
   spec already says qualifies; new user-visible behaviour does not.
2. No database schema or migration, and no new route, environment variable, domain event, job,
   dependency or public/token surface.
3. No UI change that alters layout or flow (copy and typo fixes qualify).
4. At most one feature module plus its tests, readable in one sitting (guideline: up to about five
   files and 200 changed lines, excluding tests and lockfiles).
5. No owner decision and no unresolved ambiguity.

If any criterion fails or is in doubt, stop and use `propose-change`.

## 2. Do it

1. `git status --porcelain` must show nothing you did not make.
2. Read the rules matching the files you will touch (`AGENTS.md` table; Claude Code shows the
   pointers automatically).
3. For a bug: write or extend a test that fails because of the bug, and see it fail.
4. Make the minimum change. Touch nothing outside the stated problem.
5. If the change closes a gap in `openspec/backlog.md`, remove its row in the same commit.

## 3. Verify and commit

Follow `git-commit`: `pnpm lint`, `pnpm typecheck`, the tests covering the area, explicit-path
staging, staged-set check, one commit. No `Change:` line (there is no change folder).

## 4. Review and report

For anything beyond a typo or copy edit, dispatch the `reviewer` agent on the commit hash. Fixes are
a new commit. Report the hash, what was verified, and anything not verified.
