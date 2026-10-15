---
name: implement-task
description:
  Use when executing tasks from an approved openspec change task list - runs each task in a fresh
  implementer agent, has a reviewer check it, and lands one verified commit per task.
---

Read `.agents/skills/implement-task/SKILL.md` and follow it exactly. That file is the canonical
skill; this wrapper exists because Claude Code reads skills only from `.claude/skills/`.
