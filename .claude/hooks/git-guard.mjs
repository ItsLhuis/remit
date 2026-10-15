// PreToolUse hook for the Bash and PowerShell tools: refuses git commands that break the agents'
// git policy (AGENTS.md, Owner decisions). Exit code 2 blocks the call and shows stderr to the
// agent. The decision logic lives in tools/git-guard/classify.mjs, which is unit-tested.

import { statSync } from "node:fs"
import { resolve } from "node:path"

import { classifyCommand } from "../../tools/git-guard/classify.mjs"

let input = ""

for await (const chunk of process.stdin) input += chunk

let payload

try {
  payload = JSON.parse(input)
} catch {
  // A payload this hook cannot read is not a git command it can judge; the permission rules in
  // .claude/settings.json still apply.
  process.exit(0)
}

const command = payload?.tool_input?.command

if (typeof command !== "string") process.exit(0)

const workingDirectory = typeof payload.cwd === "string" ? payload.cwd : process.cwd()

function isDirectory(path) {
  try {
    return statSync(resolve(workingDirectory, path)).isDirectory()
  } catch {
    return false
  }
}

const verdict = classifyCommand(command, isDirectory)

if (!verdict.allowed) {
  process.stderr.write(
    `Blocked by .claude/hooks/git-guard.mjs: ${verdict.reason}. Agents commit explicitly staged ` +
      `paths only and never push or rewrite history (.agents/skills/git-commit/SKILL.md).\n`
  )
  process.exit(2)
}
