# Backlog

The single register of what comes next and of every known gap. `next-step` reads it;
`tests/docs/openspec.test.ts` checks it.

## Next

Ordered; the first entry is next. Each entry is a change name and one line.

## Gaps

Every gap has exactly one owner: a change name from Next or `openspec/changes/`, `owner` (needs an
owner decision), or `accepted` (a known limit kept on purpose).

| Id    | Gap                                                                                                                                                                                                                                                                | Owner    |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| GAP-1 | `tools/git-guard/classify.mjs` misses a push hidden behind a git alias (`git -c alias.p=push p`, or an alias set with `git config alias.*`), `Invoke-Expression`/`iex` bodies and `cmd /c` bodies. Agents may not edit their own guards, so the fix is the owner's | accepted |
| GAP-2 | The Claude deny `git config core.hooksPath*` also refuses reading the value, because prefix rules cannot tell a read from a write; the guard hook already distinguishes them                                                                                       | accepted |
| GAP-3 | Claude path-scoped rule globs are not anchored to the repository root: `hooks/**` also loads the hooks pointer for `.claude/hooks/**`. Harmless today; revisit if a pointer's scope matters                                                                        | accepted |
| GAP-4 | An app exposed without a proxy that overwrites `X-Forwarded-For` lets a caller choose the address keying every address-based limit and audit window                                                                                                                | accepted |
| GAP-5 | The route writes `auth.totp.reconfigured` on every successful `enable` and every successful `verify-totp`, sign-in included (without an actor there); for a reconfiguring user `enable` only holds a secret, so the entry predates the change of factor            | owner    |
| GAP-6 | First-time enrolment keeps a race in Better Auth's `enable`: a tab that reads an unverified row while another tab's `verify-totp` marks it verified carries `verified: true` onto a new, unproven secret; it needs two requests of one user within milliseconds    | owner    |
| GAP-7 | The reconfigure hold cannot tell a missing session from a failed session read, so a transient read failure on `enable` for a verified user reaches Better Auth's handler, which replaces the factor                                                                | owner    |
