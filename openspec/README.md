# openspec

Living, dateless specifications of what Remit does, and the changes in flight. The format adapts
[OpenSpec](https://github.com/Fission-AI/OpenSpec) conventions; the OpenSpec CLI is not used.

```
openspec/
  specs/<capability>/spec.md     what the system does now (present tense, no dates)
  changes/<change-name>/         work in flight: proposal.md, tasks.md, optional design.md
  backlog.md                     ordered next work and the gap register (one owner per gap)
  templates/                     spec.md, proposal.md, tasks.md, design.md
```

## Rules

- **A spec describes current behaviour** a user or operator can observe, its invariants, and what is
  deliberately absent. Behaviour that is not built is not in a spec; it lives in a change or in
  `backlog.md`.
- **A capability** is something a user or operator can do, named with a kebab-case noun
  (`invoicing`, `client-portal`, `backups`). It usually maps to one `features/<name>` module, but a
  spec must survive a refactor of the code under it.
- **Every requirement is anchored.** Its `Enforced by:` line names a test or lint rule file that
  exists, or says `review` when only a reviewer can check it. `tests/docs/openspec.test.ts` checks
  the paths.
- **Never restate what code declares.** Lists of routes, events, environment variables, columns or
  exports are generated or tested, never hand-maintained in a spec.
- **No delta files, no merge step.** A change edits `spec.md` in the same commit as the code that
  makes the edit true. Its `proposal.md` lists the intended spec impact for review only.
- **History without dates.** The spec's Evolution section lists completed changes in order; a
  reversed decision is marked `Superseded by Dn`, never deleted. `git log -- <spec>` gives the when.
- **Closing a change** removes its folder in the last task's commit and adds the Evolution line;
  `git log --diff-filter=D -- openspec/changes/<name>` recovers it.
- **Specs grow with real changes.** Writing a spec for existing behaviour is a change of its own,
  verified against the code.
- A spec stays under 300 lines; split the capability when it grows past that.

The procedures that create and use these files are the skills in `.agents/skills/`
(`propose-change`, `plan-change`, `implement-task`, `finish-change`, `quick-change`, `next-step`,
`write-spec`).
