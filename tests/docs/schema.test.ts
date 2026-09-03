// @vitest-environment node

import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { expect, test } from "vitest"

const repoRoot = fileURLToPath(new URL("../../", import.meta.url))

const schemaDirectory = join(repoRoot, "database", "schema")

// The spread helpers from `database/schema/helpers.ts`, and the columns each one contributes.
// Hardcoded rather than read out of that file, because this list is the guard: deriving it would
// mean a helper that stopped adding `deleted_at` still matched a document that still claimed it. A
// new spread helper fails `parseTableColumns` below until it is added here.
const spreadColumns: Record<string, string[]> = {
  softDelete: ["deleted_at"],
  timestamps: ["created_at", "updated_at"]
}

// The two sentences SCHEMA.md writes instead of repeating the spread columns in every table.
const timestampsSentence = "Standard `timestamps`"
const softDeleteSentence = "and `softDelete`"

type TableColumns = Map<string, string[]>

function readStringLiteral(source: string, start: number): { next: number; text: string } {
  const quote = source[start]
  let text = quote

  for (let index = start + 1; index < source.length; index++) {
    text += source[index]

    if (source[index] === "\\") {
      text += source[index + 1] ?? ""
      index++
      continue
    }

    if (source[index] === quote) return { next: index, text }
  }

  return { next: source.length, text }
}

// Comments have to go before anything else looks at this source, and a quote-blind strip would not
// do: `clients.ts` explains a column in a comment containing backticks, which a later quote scan
// would read as an unterminated template literal and swallow the rest of the file into.
function stripComments(source: string): string {
  let stripped = ""

  for (let index = 0; index < source.length; index++) {
    const character = source[index]

    if (character === '"' || character === "'" || character === "`") {
      const literal = readStringLiteral(source, index)

      stripped += literal.text
      index = literal.next
      continue
    }

    if (character === "/" && source[index + 1] === "/") {
      while (index < source.length && source[index] !== "\n") index++
      stripped += "\n"
      continue
    }

    stripped += character
  }

  return stripped
}

function sliceObjectLiteral(source: string, from: number): string {
  const start = source.indexOf("{", from)
  let depth = 0

  for (let index = start; index < source.length; index++) {
    if (source[index] === "{") depth++

    if (source[index] === "}") {
      depth--

      if (depth === 0) return source.slice(start + 1, index)
    }
  }

  throw new Error("Unbalanced pgTable column object")
}

function splitTopLevelEntries(body: string): string[] {
  const entries: string[] = []
  let depth = 0
  let current = ""

  for (const character of body) {
    if ("{[(".includes(character)) depth++
    if ("}])".includes(character)) depth--

    if (character === "," && depth === 0) {
      entries.push(current)
      current = ""
      continue
    }

    current += character
  }

  entries.push(current)

  return entries.map((entry) => entry.trim()).filter(Boolean)
}

function parseTableColumns(tableName: string, body: string): string[] {
  return splitTopLevelEntries(body).flatMap((entry) => {
    const spread = entry.match(/^\.{3}(\w+)$/)

    if (spread) {
      const contributed = spreadColumns[spread[1]]

      if (!contributed) throw new Error(`${tableName}: unknown spread helper "${spread[1]}"`)

      return contributed
    }

    const column = entry.match(/^\w+\s*:\s*\w+\(\s*"([a-z0-9_]+)"/)

    // Refusing an entry it cannot classify is what makes a false pass impossible: a column shape
    // this parser does not recognise fails the suite instead of being skipped, which would let it
    // drift out of SCHEMA.md unnoticed.
    if (!column) throw new Error(`${tableName}: unrecognised column entry "${entry.slice(0, 60)}"`)

    return [column[1]]
  })
}

function readSchemaTables(): TableColumns {
  const tables: TableColumns = new Map()

  for (const file of readdirSync(schemaDirectory).filter((name) => name.endsWith(".ts"))) {
    const source = stripComments(readFileSync(join(schemaDirectory, file), "utf8"))
    const declaration = /pgTable\(\s*"([a-z_]+)"\s*,/g

    let match = declaration.exec(source)

    while (match) {
      tables.set(
        match[1],
        parseTableColumns(match[1], sliceObjectLiteral(source, declaration.lastIndex))
      )

      match = declaration.exec(source)
    }
  }

  return tables
}

function splitDocumentSections(document: string): Map<string, string[]> {
  const sections = new Map<string, string[]>()
  let current: string[] | null = null

  for (const line of document.split("\n")) {
    const heading = line.match(/^### `([a-z_]+)`\s*$/)

    if (heading) {
      current = []
      sections.set(heading[1], current)
      continue
    }

    if (/^#{2,3} /.test(line)) current = null

    current?.push(line)
  }

  return sections
}

function tableRowCells(line: string): string[] | null {
  if (!line.startsWith("|")) return null

  return line
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim())
}

// SCHEMA.md lists a table's columns in the first cell of a markdown table, except for `settings`,
// which groups its rows and so puts the name in the second — hence looking the header up by name
// rather than assuming a position.
function columnsInSection(lines: string[]): string[] {
  const columns: string[] = []
  let columnIndex = -1

  for (const line of lines) {
    const cells = tableRowCells(line)

    if (!cells) {
      if (line.trim()) columnIndex = -1
      if (line.includes(timestampsSentence)) columns.push("created_at", "updated_at")
      if (line.includes(softDeleteSentence)) columns.push("deleted_at")
      continue
    }

    if (cells.includes("Column")) {
      columnIndex = cells.indexOf("Column")
      continue
    }

    const cell = columnIndex === -1 ? "" : (cells[columnIndex] ?? "")

    if (/^-*$/.test(cell)) continue

    columns.push(
      ...cell
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean)
    )
  }

  return columns
}

function readDocumentedTables(): TableColumns {
  const document = readFileSync(join(repoRoot, "docs", "architecture", "SCHEMA.md"), "utf8")

  return new Map(
    [...splitDocumentSections(document)].map(([table, lines]) => [table, columnsInSection(lines)])
  )
}

function findMismatches(subject: TableColumns, reference: TableColumns): string[] {
  return [...subject].flatMap(([table, columns]) => {
    const referenceColumns = reference.get(table) ?? []

    return columns
      .filter((column) => !referenceColumns.includes(column))
      .map((column) => `${table}.${column}`)
  })
}

test("SCHEMA.md documents exactly the tables the Drizzle schema declares", () => {
  const schemaTables = [...readSchemaTables().keys()].sort()
  const documentedTables = [...readDocumentedTables().keys()].sort()

  expect(schemaTables.length).toBeGreaterThan(0)
  expect(documentedTables).toEqual(schemaTables)
})

test("SCHEMA.md documents every column each table declares", () => {
  const undocumented = findMismatches(readSchemaTables(), readDocumentedTables())

  expect(undocumented).toEqual([])
})

test("SCHEMA.md documents no column the Drizzle schema does not declare", () => {
  const invented = findMismatches(readDocumentedTables(), readSchemaTables())

  expect(invented).toEqual([])
})
