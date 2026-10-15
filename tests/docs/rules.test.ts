// @vitest-environment node

import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, test } from "vitest"

const repoRoot = fileURLToPath(new URL("../../", import.meta.url))

function readRule(name: string): string {
  return readFileSync(join(repoRoot, ".agents", "rules", name), "utf8")
}

function extractExemplarPaths(codeStyle: string): string[] {
  const start = codeStyle.indexOf("## Canonical exemplar")
  const rest = codeStyle.slice(start)
  const end = rest.indexOf("\n## ", 3)
  const section = end === -1 ? rest : rest.slice(0, end)

  const paths = new Set<string>()

  for (const line of section.split("\n")) {
    if (!line.trim().startsWith("|")) continue

    for (const match of line.matchAll(/`([^`]+)`/g)) {
      const value = match[1]

      if (/[<>*\s]/.test(value)) continue
      if (!/^(features|app|lib|components|hooks|database)\//.test(value)) continue
      if (!value.endsWith(".ts") && !value.endsWith(".tsx") && !value.endsWith("/")) continue
      if ((value.match(/\//g)?.length ?? 0) < 2) continue

      paths.add(value.replace(/\/$/, ""))
    }
  }

  return [...paths]
}

describe("rule docs stay in sync with the codebase", () => {
  test("every canonical exemplar path in code-style.md exists", () => {
    const exemplars = extractExemplarPaths(readRule("code-style.md"))

    expect(exemplars.length).toBeGreaterThan(0)

    const missing = exemplars.filter((path) => !existsSync(join(repoRoot, path)))

    expect(missing).toEqual([])
  })

  test("every rule file is linked from AGENTS.md and has a path-scoped Claude pointer", () => {
    const ruleFiles = readdirSync(join(repoRoot, ".agents", "rules")).filter((name) =>
      name.endsWith(".md")
    )
    const agentsDoc = readFileSync(join(repoRoot, "AGENTS.md"), "utf8")

    const unregistered = ruleFiles.filter((name) => {
      const pointerPath = join(repoRoot, ".claude", "rules", name)

      if (!agentsDoc.includes(`.agents/rules/${name}`) || !existsSync(pointerPath)) return true

      const pointer = readFileSync(pointerPath, "utf8")

      return !/^---\r?\npaths:\r?\n/.test(pointer) || !pointer.includes(`\`.agents/rules/${name}\``)
    })

    expect(unregistered).toEqual([])
  })

  test("every Claude rule pointer names an existing canonical rule", () => {
    const orphans = readdirSync(join(repoRoot, ".claude", "rules")).filter(
      (name) => !existsSync(join(repoRoot, ".agents", "rules", name))
    )

    expect(orphans).toEqual([])
  })

  // An @-import loads at launch even from inside a path-scoped rule, so importing a rule from
  // CLAUDE.md or from a pointer would put it back into every session's context.
  test("no instruction file @-imports a rule", () => {
    const importers = [
      "CLAUDE.md",
      "AGENTS.md",
      ...readdirSync(join(repoRoot, ".claude", "rules")).map((name) => `.claude/rules/${name}`)
    ].filter((path) => /^@\S*\.agents\/rules\//m.test(readFileSync(join(repoRoot, path), "utf8")))

    expect(importers).toEqual([])
  })
})
