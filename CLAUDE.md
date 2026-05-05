# CLAUDE.md

@AGENTS.md

## Claude Code Imports

Claude Code does not natively read `AGENTS.md`, so this file imports it as the shared cross-agent
entrypoint. Keep Claude-specific settings and command wrappers in `.claude/`.

Detailed shared rules live canonically in `.agents/rules/`. They are imported here explicitly so
Claude Code can load the same guidance without duplicating rule content.

@.agents/rules/accessibility.md @.agents/rules/actions.md @.agents/rules/architecture.md
@.agents/rules/code-style.md @.agents/rules/components.md @.agents/rules/database.md
@.agents/rules/errors.md @.agents/rules/forms.md @.agents/rules/hooks.md @.agents/rules/imports.md
@.agents/rules/security.md @.agents/rules/testing.md @.agents/rules/types.md
