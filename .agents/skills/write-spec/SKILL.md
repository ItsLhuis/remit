---
name: write-spec
description:
  Use when writing or rewriting a capability spec under openspec/specs - turns verified behaviour
  into requirements with scenarios and anchors, decisions, evolution and known limits.
---

# Write a capability spec

A spec states what the system does now, verified against the code. Format and rules:
`openspec/README.md`; skeleton: `openspec/templates/spec.md`; checks: `tests/docs/openspec.test.ts`.

## 1. Bound the capability

- One capability = something a user or operator can do (`invoicing`, `client-portal`). Name it with
  a kebab-case noun. It must be rewritable in one sitting: if it would pass 300 lines, split it.
- List the code that implements it: routes, `features/<name>/` modules, jobs, scripts.

## 2. Collect claims, then verify each against the code

Sources (the code, its tests and existing specs) give claims. Treat every claim as a hypothesis:
trace it end to end — route → query/mutation → service → schema → test — before writing it down.

- Built and tested → a requirement anchored to that test.
- Built, no test → a requirement with `Enforced by: review`, plus a gap if it deserves a test.
- Claimed but not built → not a requirement. Register a gap (`openspec/backlog.md`) or drop the
  claim if it was never decided.
- A claim that drifted once has usually drifted in sibling documents too; re-check those.

## 3. Write

- **Requirements**: `### Requirement: <name>`; one SHALL/MUST sentence about observable behaviour;
  at least one `#### Scenario:` with WHEN/THEN; `Enforced by:` with backticked test or lint rule
  paths, or `review`.
- **How it works**: short, with entry-point paths. Never restate lists the code declares (routes,
  events, env vars, columns, export lists); point at the source file instead.
- **Decisions**: `### Dn: <decision>` — what, why, rejected alternatives. A reversed decision stays
  and gets `Superseded by Dm`. Cross-cutting principles stay in `docs/architecture/ARCHITECTURE.md`.
- **Evolution**: one line per completed change, oldest first; no dates.
- **Known limits**: `- GAP-<n>: <limit>`, each registered in `openspec/backlog.md` with one owner.
- **Status**: `verified` only when every requirement was checked against the code; otherwise
  `draft`.

Present tense, English, no dates, no citations of gitignored paths.

## 4. Check and commit

`pnpm exec vitest run tests/docs/openspec.test.ts`, then commit with `git-commit`.
