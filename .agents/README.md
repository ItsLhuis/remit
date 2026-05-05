# Shared Agent Guidance

`.agents/` is the canonical portable AI-agent guidance directory for this repository.

- `rules/` contains shared project rules used by Codex, Claude Code, and other coding agents.
- `skills/` contains reusable portable workflows.
- `AGENTS.md` is the cross-agent entrypoint, especially for Codex.
- `CLAUDE.md` remains for Claude-specific bootstrapping and compatibility.
- `.claude/` remains for Claude-specific settings and command wrappers.
- `.codex/` remains for Codex-specific configuration and command policy.

Keep shared guidance here to avoid duplicated rule sources. Tool-specific files should link to this
directory instead of copying long rule content.
