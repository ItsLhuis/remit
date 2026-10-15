---
name: write-skill
description:
  Use when creating, renaming or editing a skill under .agents/skills or an agent under
  .agents/agents - covers the description formula, size budgets, wrappers and trigger tests.
---

# Write a skill or agent

Skills hold procedures loaded on demand; agents hold isolated roles. Constraints that apply to every
session belong in `AGENTS.md`; conventions for a kind of file belong in a rule under
`.agents/rules/`; anything a tool can check belongs in lint, a test or a hook — a skill is never
enforcement.

## Before writing

1. Is it general? A skill or agent must serve any future task. Never write one for a single feature,
   capability or migration.
2. Does an existing skill already cover it? Extend that one rather than adding an overlapping
   trigger. List them: `ls .agents/skills .agents/agents`.
3. Write the trigger test first: three requests that must trigger it and three near-misses that must
   not (one of which belongs to a neighbouring skill). Keep them in your report.

## Skill layout

```
.agents/skills/<name>/SKILL.md      canonical (Codex reads this location)
.claude/skills/<name>/SKILL.md      Claude Code wrapper: identical name and description, body points
                                    to the canonical file
```

- `name`: kebab-case, at most 64 characters, equal to the folder name.
- Frontmatter uses only `name` and `description` so the file is valid in every tool
  (agentskills.io).
- Supporting material goes beside SKILL.md, one level deep, and is linked from the body.

## Description formula

`Use when <situations, in the words a requester would use> - <what it does, in a few words>.`

- Third person, triggers first, at most 250 characters (hard cap 400, tested).
- Name the situations, not the internals. A description that summarises the procedure gets the model
  to skip the body.
- No overlap: if two descriptions would both match a request, sharpen one or merge the skills.

## Body

- At most 150 lines (hard cap 200, tested); the steps that matter in the first 100 lines, because
  compaction keeps only the head of a long skill.
- Numbered steps in imperative voice; each step says what to run or read and what counts as done.
- Say where to stop and ask the owner. Never smuggle a preferred answer into a question: present
  options with a recommendation, and let the owner decide.
- Point at rules and specs by path instead of restating them.
- English, no dates, and no references to gitignored paths (a test rejects them).
- Original wording. Ideas from third-party skill packs may be adapted; their text is not copied.

## Agent layout

```
.agents/agents/<name>.md            canonical role prompt
.claude/agents/<name>.md            wrapper: name, description, tools; body points to the canonical
.codex/agents/<name>.toml           wrapper: name, description, developer_instructions pointing to it
```

An agent body stays under 120 lines. Give an agent only the tools its role needs (a reviewer gets no
edit tools).

## Verify

1. `pnpm exec vitest run tests/docs` — frontmatter, budgets, wrapper parity and referenced paths.
2. Run the trigger test: read each request against every skill description and confirm exactly one
   matches.
3. Add the skill to the list in `AGENTS.md` ("How work is done") when it is part of the flow.
