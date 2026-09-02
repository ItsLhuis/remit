// @vitest-environment node

import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { expect, test } from "vitest"

const repoRoot = fileURLToPath(new URL("../../", import.meta.url))
const deliveryDirectory = join(repoRoot, "docs", "delivery")

// Hardcoded rather than derived from the records, because this list is the guard: reading the
// section headings out of the files being checked would make any record that drops a section
// self-consistent and pass.
const REQUIRED_SECTIONS = ["What", "Why", "Scope", "How", "Evidence", "Verification", "Known gaps"]

const SEAL_REQUIRED_SECTIONS = ["Evidence", "Verification"]

function recordFileNames(): string[] {
  return readdirSync(deliveryDirectory)
    .filter((name) => name.endsWith(".md") && name !== "README.md")
    .sort()
}

function readRecord(name: string): string {
  return readFileSync(join(deliveryDirectory, name), "utf8")
}

function readIndex(): string {
  return readFileSync(join(deliveryDirectory, "README.md"), "utf8")
}

function indexedRecordFiles(): string[] {
  const files = new Set<string>()

  for (const line of readIndex().split("\n")) {
    if (!line.trim().startsWith("|")) continue

    for (const match of line.matchAll(/\]\((\d{4}-[a-z0-9-]+\.md)\)/g)) {
      files.add(match[1])
    }
  }

  return [...files]
}

function frontMatterValue(content: string, field: string): string | null {
  const match = content.match(new RegExp(`^- \\*\\*${field}:\\*\\* (.+)$`, "m"))

  return match ? match[1].trim() : null
}

function sectionBody(content: string, heading: string): string {
  const start = content.indexOf(`\n## ${heading}\n`)

  if (start === -1) return ""

  const rest = content.slice(start + heading.length + 5)
  const end = rest.indexOf("\n## ")

  return (end === -1 ? rest : rest.slice(0, end)).trim()
}

test("every delivery record is listed in the index", () => {
  const records = recordFileNames()
  const indexed = new Set(indexedRecordFiles())

  const missing = records.filter((name) => !indexed.has(name))

  expect(records.length).toBeGreaterThan(0)
  expect(missing).toEqual([])
})

test("every index row points at a record file that exists", () => {
  const indexed = indexedRecordFiles()

  const broken = indexed.filter((name) => !existsSync(join(deliveryDirectory, name)))

  expect(indexed.length).toBeGreaterThan(0)
  expect(broken).toEqual([])
})

test("record numbering is unique and contiguous from one", () => {
  const numbers = recordFileNames().map((name) => Number.parseInt(name.slice(0, 4), 10))

  const expected = Array.from({ length: numbers.length }, (_, index) => index + 1)

  expect([...numbers].sort((left, right) => left - right)).toEqual(expected)
})

test("every record carries all required sections", () => {
  const offenders = recordFileNames().filter((name) => {
    const content = readRecord(name)

    return REQUIRED_SECTIONS.some((heading) => !content.includes(`\n## ${heading}\n`))
  })

  expect(offenders).toEqual([])
})

test("a shipped record has no empty evidence or verification section", () => {
  const offenders = recordFileNames().filter((name) => {
    const content = readRecord(name)

    if (frontMatterValue(content, "Status") !== "Shipped") return false

    return SEAL_REQUIRED_SECTIONS.some((heading) => sectionBody(content, heading).length === 0)
  })

  expect(offenders).toEqual([])
})

test("every supersedes reference resolves to an existing record", () => {
  const numbers = new Set(recordFileNames().map((name) => name.slice(0, 4)))

  const broken = recordFileNames().flatMap((name) => {
    const value = frontMatterValue(readRecord(name), "Supersedes")

    if (value === null || value === "—") return []

    return [...value.matchAll(/DR-(\d{4})/g)]
      .filter((match) => !numbers.has(match[1]))
      .map((match) => `${name} -> DR-${match[1]}`)
  })

  expect(broken).toEqual([])
})

test("no record cites a gitignored prompt or superpowers path", () => {
  const offenders = [...recordFileNames(), "README.md"].filter((name) =>
    /docs\/(prompts|superpowers)\//.test(readRecord(name))
  )

  expect(offenders).toEqual([])
})
