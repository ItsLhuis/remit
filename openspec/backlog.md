# Backlog

The single register of what comes next and of every known gap. `next-step` reads it;
`tests/docs/openspec.test.ts` checks it.

## Next

Ordered; the first entry is next. Each entry is a change name and one line.

## Gaps

Every gap has exactly one owner: a change name from Next or `openspec/changes/`, `owner` (needs an
owner decision), or `accepted` (a known limit kept on purpose).

| Id    | Gap                                                                                                                                                                                                                                                                                           | Owner    |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| GAP-1 | `tools/git-guard/classify.mjs` misses a push hidden behind a git alias (`git -c alias.p=push p`, or an alias set with `git config alias.*`), `Invoke-Expression`/`iex` bodies and `cmd /c` bodies. Agents may not edit their own guards, so the fix is the owner's                            | accepted |
| GAP-2 | The Claude deny `git config core.hooksPath*` also refuses reading the value, because prefix rules cannot tell a read from a write; the guard hook already distinguishes them                                                                                                                  | accepted |
| GAP-3 | Claude path-scoped rule globs are not anchored to the repository root: `hooks/**` also loads the hooks pointer for `.claude/hooks/**`. Harmless today; revisit if a pointer's scope matters                                                                                                   | accepted |
| GAP-4 | An app exposed without a proxy that overwrites `X-Forwarded-For` lets a caller choose the address keying every address-based limit and audit window                                                                                                                                           | owner    |
| GAP-5 | `tools/git-guard/classify.mjs` lets `git add` pass a path with `[` when it names an existing file, but git still reads it as a glob, so `r/[id]/page.tsx` can also stage `r/i/page.tsx`; a literal pathspec (`:(literal)`) or a sibling check would close it. Its tests have no case with `[` | owner    |
