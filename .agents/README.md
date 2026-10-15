# Shared Agent Guidance

`.agents/` holds the one canonical copy of everything that instructs AI agents in this repository.
Tool-specific folders only register or scope it, so content never exists twice.

| Canonical                  | Claude Code                                  | Codex                                |
| -------------------------- | -------------------------------------------- | ------------------------------------ |
| `AGENTS.md` (repo root)    | `CLAUDE.md` imports it                       | read natively                        |
| `rules/<name>.md`          | `.claude/rules/<name>.md` pointer + `paths:` | `AGENTS.md` table of files → rules   |
| `skills/<name>/SKILL.md`   | `.claude/skills/<name>/SKILL.md` wrapper     | read natively from `.agents/skills/` |
| `agents/<name>.md`         | `.claude/agents/<name>.md` wrapper           | `.codex/agents/<name>.toml` wrapper  |
| permissions and guard hook | `.claude/settings.json`, `.claude/hooks/`    | `.codex/rules/default.rules`         |

Why wrappers and pointers instead of imports or symlinks: Claude Code loads every `@`-import at
launch, even from a path-scoped rule, and reads nothing under `.agents/`; symlinks are unreliable on
Windows checkouts; and the rule paths are cited from code, tests and docs, so they cannot move.

Wrappers repeat only a skill's `name` and `description` (Claude needs them in its own folder);
`tests/docs/agentFiles.test.ts` keeps them identical to the canonical frontmatter and enforces the
size budgets. To add or change a skill or agent, follow `skills/write-skill/SKILL.md`.
