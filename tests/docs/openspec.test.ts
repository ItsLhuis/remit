// @vitest-environment node

import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, test } from "vitest"

const repoRoot = fileURLToPath(new URL("../../", import.meta.url))
const openspecRoot = join(repoRoot, "openspec")

// Hardcoded rather than read from the template, because this list is the guard: deriving it from
// the file being checked would let a template that drops a section pass.
const SPEC_SECTIONS = [
  "Status",
  "Requirements",
  "How it works",
  "Decisions",
  "Evolution",
  "Known limits"
]

const SPEC_STATUSES = ["draft", "verified"]

const MAX_SPEC_LINES = 300

const GAP_OWNER_KEYWORDS = ["owner", "accepted"]

function read(path: string): string {
  return readFileSync(path, "utf8").replaceAll("\r\n", "\n")
}

function listDirectories(path: string): string[] {
  if (!existsSync(path)) return []

  return readdirSync(path, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
}

function sectionBody(markdown: string, heading: string): string {
  const start = markdown.indexOf(`\n## ${heading}\n`)

  if (start === -1) return ""

  const rest = markdown.slice(start + heading.length + 5)
  const end = rest.indexOf("\n## ")

  return end === -1 ? rest : rest.slice(0, end)
}

// Returns every problem in one spec, so a failing run lists all of them rather than the first.
function specProblems(markdown: string, isTemplate: boolean): string[] {
  const problems: string[] = []

  const headings = [...markdown.matchAll(/^## (.+)$/gm)].map((match) => match[1].trim())
  const ordered = headings.filter((heading) => SPEC_SECTIONS.includes(heading))

  if (ordered.join("|") !== SPEC_SECTIONS.join("|")) {
    problems.push(
      `sections must be ${SPEC_SECTIONS.join(", ")} in order; found ${headings.join(", ")}`
    )
  }

  const status = sectionBody(markdown, "Status").trim()

  if (!SPEC_STATUSES.includes(status)) problems.push(`status "${status}" is not draft or verified`)

  if (markdown.split("\n").length > MAX_SPEC_LINES) {
    problems.push(`longer than ${MAX_SPEC_LINES} lines; split the capability`)
  }

  const requirements = sectionBody(markdown, "Requirements").split(/\n(?=### Requirement: )/)
  const named = requirements.filter((block) => block.trimStart().startsWith("### Requirement: "))

  if (named.length === 0) problems.push("no requirement")

  for (const block of named) {
    const name = block.trimStart().split("\n")[0]

    if (!/\b(SHALL|MUST)\b/.test(block)) problems.push(`${name}: no SHALL or MUST`)
    if (!block.includes("\n#### Scenario: ")) problems.push(`${name}: no scenario`)

    const anchor = block.match(/^Enforced by: (.+)$/m)

    if (!anchor) {
      problems.push(`${name}: no "Enforced by:" line`)

      continue
    }

    if (isTemplate || anchor[1].trim() === "review") continue

    for (const path of [...anchor[1].matchAll(/`([^`]+)`/g)].map((match) => match[1])) {
      if (!existsSync(join(repoRoot, path))) problems.push(`${name}: anchor ${path} does not exist`)
    }
  }

  return problems
}

function backlogGapRows(): { id: string; owner: string }[] {
  return sectionBody(read(join(openspecRoot, "backlog.md")), "Gaps")
    .split("\n")
    .filter((line) => line.startsWith("|") && !/^\|\s*(Id|-)/.test(line))
    .map((line) => {
      const cells = line.split("|").map((cell) => cell.trim())

      return { id: cells[1], owner: cells[3].replaceAll("`", "") }
    })
}

function backlogNextChanges(): string[] {
  return [
    ...sectionBody(read(join(openspecRoot, "backlog.md")), "Next").matchAll(/^\d+\. `([^`]+)`/gm)
  ].map((match) => match[1])
}

describe("openspec stays well-formed", () => {
  test("the spec template satisfies the spec format", () => {
    expect(specProblems(read(join(openspecRoot, "templates", "spec.md")), true)).toEqual([])
  })

  test("every capability spec satisfies the spec format and its anchors exist", () => {
    const problems = listDirectories(join(openspecRoot, "specs")).flatMap((capability) => {
      const path = join(openspecRoot, "specs", capability, "spec.md")

      if (!existsSync(path)) return [`${capability}: missing spec.md`]

      return specProblems(read(path), false).map((problem) => `${capability}: ${problem}`)
    })

    expect(problems).toEqual([])
  })

  // A proposal is committed alone and waits for the owner at Gate 1; the task list is written only
  // after approval, so it is required from then on.
  test("every change folder has a proposal, and a task list once Gate 1 is approved", () => {
    const missing = listDirectories(join(openspecRoot, "changes")).flatMap((change) => {
      const proposalPath = join(openspecRoot, "changes", change, "proposal.md")

      if (!existsSync(proposalPath)) return [`${change}/proposal.md`]

      const gate = sectionBody(read(proposalPath), "Gate 1").trim()

      if (!["pending", "approved"].includes(gate)) return [`${change}: Gate 1 is "${gate}"`]

      const needsTasks = gate === "approved"

      return needsTasks && !existsSync(join(openspecRoot, "changes", change, "tasks.md"))
        ? [`${change}/tasks.md`]
        : []
    })

    expect(missing).toEqual([])
  })

  test("every gap has a unique id and exactly one known owner", () => {
    const rows = backlogGapRows()
    const owners = new Set([
      ...GAP_OWNER_KEYWORDS,
      ...backlogNextChanges(),
      ...listDirectories(join(openspecRoot, "changes"))
    ])

    const duplicates = rows
      .map((row) => row.id)
      .filter((id, index, ids) => ids.indexOf(id) !== index)
    const unowned = rows
      .filter((row) => !owners.has(row.owner))
      .map((row) => `${row.id} -> ${row.owner}`)

    expect(duplicates).toEqual([])
    expect(unowned).toEqual([])
  })

  test("every known limit in a spec is registered in the backlog", () => {
    const registered = new Set(backlogGapRows().map((row) => row.id))

    const unregistered = listDirectories(join(openspecRoot, "specs")).flatMap((capability) => {
      const path = join(openspecRoot, "specs", capability, "spec.md")

      if (!existsSync(path)) return []

      return [...sectionBody(read(path), "Known limits").matchAll(/^- (GAP-\d+):/gm)]
        .map((match) => match[1])
        .filter((id) => !registered.has(id))
        .map((id) => `${capability}: ${id}`)
    })

    expect(unregistered).toEqual([])
  })
})
