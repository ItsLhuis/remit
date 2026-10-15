# Backlog

The single register of what comes next and of every known gap. `next-step` reads it;
`tests/docs/openspec.test.ts` checks it.

## Next

Ordered; the first entry is next. Each entry is a change name and one line.

1. `docs-to-specs-pilot` — migrate two capabilities from `docs/` into `openspec/specs/` with
   `write-spec`, verified against the code

## Gaps

Every gap has exactly one owner: a change name from Next or `openspec/changes/`, `owner` (needs an
owner decision), or `accepted` (a known limit kept on purpose).

| Id  | Gap | Owner |
| --- | --- | ----- |
