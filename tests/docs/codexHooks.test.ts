// @vitest-environment node

import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, test } from "vitest"

const repoRoot = fileURLToPath(new URL("../../", import.meta.url))

const GUARD_SCRIPT = ".claude/hooks/git-guard.mjs"

type HookEntry = { matcher?: string; hooks: { type: string; command: string }[] }
type HooksFile = { hooks: { PreToolUse?: HookEntry[] } }

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(join(repoRoot, path), "utf8")) as T
}

function guardCommands(path: string): string[] {
  const file = readJson<HooksFile>(path)

  return (file.hooks.PreToolUse ?? []).flatMap((entry) =>
    entry.hooks.map((hook) => hook.command).filter((command) => command.includes(GUARD_SCRIPT))
  )
}

describe("git policy hook parity", () => {
  test("the guard script exists", () => {
    expect(existsSync(join(repoRoot, GUARD_SCRIPT))).toBe(true)
  })

  test("Claude Code runs the guard before Bash and PowerShell calls", () => {
    const settings = readJson<{ hooks: { PreToolUse: HookEntry[] } }>(".claude/settings.json")
    const entry = settings.hooks.PreToolUse.find((item) =>
      item.hooks.some((hook) => hook.command.includes(GUARD_SCRIPT))
    )

    expect(entry?.matcher).toBe("Bash|PowerShell")
  })

  test("Codex runs the same guard before Bash calls", () => {
    const codex = readJson<HooksFile>(".codex/hooks.json")
    const entry = (codex.hooks.PreToolUse ?? []).find((item) =>
      item.hooks.some((hook) => hook.command.includes(GUARD_SCRIPT))
    )

    expect(entry?.matcher).toBe("Bash")
    expect(guardCommands(".codex/hooks.json")).toHaveLength(1)
  })

  test("both tools run the guard with a node command", () => {
    const commands = [
      ...guardCommands(".claude/settings.json"),
      ...guardCommands(".codex/hooks.json")
    ]

    expect(commands).toHaveLength(2)
    expect(commands.every((command) => command.startsWith("node "))).toBe(true)
  })
})
