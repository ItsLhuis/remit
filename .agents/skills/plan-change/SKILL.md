---
name: plan-change
description:
  Use when a change proposal has been approved and needs a design or a task list - breaks the work
  into ordered, individually verifiable tasks, with the design gate for UI work.
---

# Plan a change

Input: `openspec/changes/<name>/proposal.md` approved by the owner. Output: `tasks.md`, plus
`design.md` when needed. Still no product code.

## 1. Record Gate 1

Set `## Gate 1` to `approved` and move answered questions into the proposal body.

## 2. Design, only when needed

Write `design.md` from `openspec/templates/design.md` when the change has UI or spans more than one
capability.

- Technical approach: name the code paths, the rejected alternatives and why. Ask the `reviewer`
  agent to challenge it before going on.
- UI: the owner owns UI/UX and Figma. Describe the states to build and ask for the mockup or the
  owner's decision; set `## Gate 2` to `pending` and stop until the owner approves. Do not invent a
  visual design.

## 3. Write the tasks

Copy `openspec/templates/tasks.md`. Each task:

- is one commit that leaves the repository working (lint, typecheck, tests green);
- names what to change, the observable "Done when", and a `Verify:` command that proves it;
- includes the tests that prove it and, when behaviour changes, the edit to
  `openspec/specs/<capability>/spec.md` that makes the spec say what the code now does;
- is small enough for a fresh agent to finish without the history of this conversation.

Order tasks so foundations come first (schema → services → queries/mutations → UI → docs). A
migration task runs `pnpm database:generate` and never hand-edits the output.

## 4. Check the plan

Before committing, confirm against the proposal: every Spec impact item lands in some task; every
Out item is untouched; every task's Verify command exists and would fail before the task. Fix gaps,
do not paper over them.

## 5. Commit

Commit `proposal.md`, `tasks.md` and `design.md` with `git-commit`
(`docs(openspec): plan <change-name>`). Then continue with `implement-task`, unless Gate 2 is
pending.
