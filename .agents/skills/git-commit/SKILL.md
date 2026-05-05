---
name: git-commit
description:
  Use when the user asks to create, prepare, review, or suggest a git commit, commit message, or
  conventional commit for this repository.
---

# Git Commit Skill

Use this workflow for repository commits and commit-message suggestions.

## Required Checks

1. Inspect repository state with `git status --short`.
2. Inspect staged changes with `git diff --staged`.
3. If nothing is staged, ask whether to stage files or suggest the relevant files. Do not assume
   what should be staged.
4. Inspect `commitlint.config.mjs` before enforcing commit format. If that file is absent, check the
   other standard commitlint locations before falling back.
5. Use Conventional Commits only when commitlint confirms it. This repository currently uses
   `@commitlint/config-conventional` with allowed types from `type-enum`.

## Commit Rules

- Do not run `git commit` unless the user explicitly asks to commit.
- Do not amend, rebase, reset, push, or force-push unless explicitly requested.
- Respect the parsed commitlint rules for allowed types, scopes, subject/header limits, and case
  rules.
- Keep commits atomic and dependency-safe. Do not commit code that depends on unstaged or
  uncommitted changes.
- Use imperative, concise subjects with no final period when Conventional Commits apply.
- Never add AI co-author trailers or AI attribution.

## Suggested Analysis

Use these commands as needed, from the repository root:

```bash
git status --short
git diff --staged
git diff
git diff --stat
cat commitlint.config.mjs
```

If the user asks for a commit message only, provide the message and any staging caveats. If the user
asks to commit, stage only the confirmed files and run `git commit -m "<message>"` after the checks
above.
