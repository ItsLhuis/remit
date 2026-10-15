# CLAUDE.md

@AGENTS.md

## Claude Code

- Rules load by path: each `.claude/rules/<name>.md` carries `paths:` globs and points at the
  canonical `.agents/rules/<name>.md`. When one appears in context, read the file it names before
  editing. Never `@`-import a rule here: imports load at launch, even inside a path-scoped file.
- Skills are `.claude/skills/<name>/SKILL.md` wrappers and agents are `.claude/agents/<name>.md`
  wrappers; both point at the canonical copy under `.agents/`.
- Bash commands run from the repository root; never prefix them with `cd`, which defeats the
  path-based permission rules.
