// @vitest-environment node

import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { expect, test } from "vitest"

const repoRoot = fileURLToPath(new URL("../../", import.meta.url))

const adrDirectory = join(repoRoot, "docs", "architecture", "adr")

function readArchitecture(): string {
  return readFileSync(join(repoRoot, "docs", "architecture", "ARCHITECTURE.md"), "utf8")
}

function readAdrIndex(): string {
  return readFileSync(join(adrDirectory, "README.md"), "utf8")
}

// The `adr/README.md` table links siblings (`0001-….md`) where the ARCHITECTURE.md table links
// through the directory (`adr/0001-….md`), so the two are compared on file names rather than on
// their raw rows.
function extractAdrIndexFiles(index: string): string[] {
  const files = new Set<string>()

  for (const line of index.split("\n")) {
    if (!line.trim().startsWith("|")) continue

    for (const match of line.matchAll(/\((\d{4}-[^)]+\.md)\)/g)) {
      files.add(match[1])
    }
  }

  return [...files]
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
  const adrFiles = readdirSync(adrDirectory).filter(
    (name) => name.endsWith(".md") && name !== "README.md"
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

test("the adr directory index lists exactly the ADR files on disk", () => {
  const adrFiles = readdirSync(adrDirectory)
    .filter((name) => name.endsWith(".md") && name !== "README.md")
    .sort()
  const indexed = extractAdrIndexFiles(readAdrIndex()).sort()

  expect(adrFiles.length).toBeGreaterThan(0)
  expect(indexed).toEqual(adrFiles)
})

test("the adr directory index and the ARCHITECTURE.md index agree", () => {
  const architectureIndexed = extractIndexedAdrFiles(readArchitecture()).sort()
  const directoryIndexed = extractAdrIndexFiles(readAdrIndex()).sort()

  expect(directoryIndexed).toEqual(architectureIndexed)
})
