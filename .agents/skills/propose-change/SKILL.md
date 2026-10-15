---
name: propose-change
description:
  Use when asked to build, add or change behaviour that is not a quick fix - new features, new
  surfaces, behaviour changes, multi-step work - to scope it with the owner before any code.
---

# Propose a change

Produce `openspec/changes/<change-name>/proposal.md` and stop at Gate 1. No code in this skill.

## 1. Explore before asking

- Read the capability specs the request touches (`openspec/specs/**`), the related code, and
  `openspec/backlog.md` for gaps it would close.
- Look facts up instead of asking the owner for them; use the `researcher` agent for anything that
  needs a wide search, the web or library documentation.
- Check the quick-path criteria in `quick-change`. If all hold, switch to that skill.

## 2. Name the change

A kebab-case verb phrase describing the outcome (`add-credit-balance`, `fix-overdue-reminders`). No
dates, no ticket numbers. It must not collide with a folder in `openspec/changes/`.

## 3. Interview the owner, in rounds

Ask only what the code and docs cannot answer: intent, product position, scope edges, trade-offs.

- At most five questions per round, each with your recommended answer and why.
- Offer real options neutrally; never phrase a question so that only your preferred answer fits.
- Stop interviewing when every open question has an answer or an explicit "owner decides later".
- When the owner cannot answer now (an unattended run), do not guess: write each question with its
  recommended answer under Open questions, commit, and stop at Gate 1.
- The owner's language of conversation may differ; everything written to the repository is English.

## 4. Write the proposal

Copy `openspec/templates/proposal.md` and fill it:

- **Product position first** for net-new work: who gains what, and why now.
- **Scope** with an explicit Out list.
- **Capabilities touched** with their spec paths, or `new`.
- **Spec impact**: requirements added, modified, removed — and, for fixes and refactors, the
  behaviour that must stay unchanged.
- **Open questions** with recommended answers; empty when the owner approves.
- `## Gate 1` → `pending`.

Add the change to the top of `openspec/backlog.md` Next if it is not already listed, and set the
owner of any gap it closes to the change name.

## 5. Commit and stop

Commit the proposal and backlog edit with `git-commit` (`docs(openspec): propose <change-name>`).
Then present the proposal summary and the open questions to the owner and stop. Gate 1 is passed
only when the owner approves; record it as `## Gate 1` → `approved` in the next commit
(`plan-change` does this).
