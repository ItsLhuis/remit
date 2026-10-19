---
name: finish-change
description:
  Use when every task of an openspec change is ticked - verifies the whole change against its
  proposal and the code, lands spec status and gaps, closes the change for owner review.
---

# Finish a change

Close `openspec/changes/<name>/` only after proving the whole change, not each task, is done.

## 1. Full verification

Run and read: `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm test:integration` when the
change touched mutations, queries, jobs or adapters (start the test database with
`pnpm database:test:up` and `pnpm database:test:migrate` if it is not running). A skipped or
unavailable check is reported as not verified, never as passing.

## 2. Goal-backward check

Dispatch the `reviewer` agent on the commit range of the change
(`git log --oneline --grep "Change: <name>,"`) with the proposal. It checks, from the goal back:

- every Spec impact item exists in the code and in the spec, with its `Enforced by:` anchor;
- every unchanged-behaviour item still holds;
- every Out item is untouched;
- the tests that guard the change fail without it (spot-check at least one).

Findings become a new task in `tasks.md`, implemented with `implement-task`, then repeat this step.

## 3. Land the spec

In `openspec/specs/<capability>/spec.md` for each capability touched:

- requirements match the code and every anchor path exists;
- decisions taken during the change are in Decisions (`Dn`, with rejected alternatives); read them
  back from the proposal, design and review findings;
- set Status to `verified` when every requirement was checked against the code in this change;
- Known limits: every limit has a `GAP-<n>` id registered in `openspec/backlog.md` with one owner.

Did the change rely on a convention no rule states? Register a gap owned by `owner` naming the rule
that should state it.

## 4. Close

In one commit (`docs(openspec): close <name>`, body `Change: <name>, close`): the spec edits, the
backlog update (remove the change from Next, re-own or close its gaps), and the removal of
`openspec/changes/<name>/` with `git rm -r -- openspec/changes/<name>`. Run
`pnpm exec vitest run tests/docs` first.

## 5. Gate 3 hand-off

Report to the owner: the commit list (`git log --oneline <first>^..HEAD`), what was verified and
how, anything not verified, new gaps and who owns them. The owner reviews and pushes; never push.
