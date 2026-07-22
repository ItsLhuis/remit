// @vitest-environment node

import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { expect, test } from "vitest"

const repoRoot = fileURLToPath(new URL("../../", import.meta.url))

function readArchitecture(): string {
  return readFileSync(join(repoRoot, "docs", "architecture", "ARCHITECTURE.md"), "utf8")
}

function extractIndexedAdrFiles(architecture: string): string[] {
  const start = architecture.indexOf("## 20. Architecture Decision Records")
  const rest = architecture.slice(start)
  const end = rest.indexOf("\n## ", 3)
  const section = end === -1 ? rest : rest.slice(0, end)

  const files = new Set<string>()

  for (const line of section.split("\n")) {
    if (!line.trim().startsWith("|")) continue

    for (const match of line.matchAll(/\(adr\/([^)]+\.md)\)/g)) {
      files.add(match[1])
    }
  }

  return [...files]
}

test("every ADR file is listed in the ARCHITECTURE.md decision index", () => {
  const adrFiles = readdirSync(join(repoRoot, "docs", "architecture", "adr")).filter((name) =>
    name.endsWith(".md")
  )
  const indexed = new Set(extractIndexedAdrFiles(readArchitecture()))

  const missing = adrFiles.filter((name) => !indexed.has(name))

  expect(adrFiles.length).toBeGreaterThan(0)
  expect(missing).toEqual([])
})

test("every ADR row in the ARCHITECTURE.md decision index points at a file that exists", () => {
  const indexed = extractIndexedAdrFiles(readArchitecture())

  const broken = indexed.filter(
    (name) => !existsSync(join(repoRoot, "docs", "architecture", "adr", name))
  )

  expect(indexed.length).toBeGreaterThan(0)
  expect(broken).toEqual([])
})
