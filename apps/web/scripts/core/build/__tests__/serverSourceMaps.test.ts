import { expect, test } from "vitest"

import { decodeMappings } from "@/lib/errorTracking/sourceMapCodec"

import { toShippedSourceMap } from "../serverSourceMaps"

// A minifier's output for the source below: `allocate` renamed to `a` and `counter` to `b`, with a
// map that, like Turbopack's, records where each came from and not what it was called.
const GENERATED = "function a(b){return b}"

const SOURCE = "function allocate(counter) {\n  return counter\n}"

// Segments at `function`, `a`, `b` and `return`, mapped to `function`, `allocate`, `counter` and
// `return` in the source.
const UNNAMED_MAPPINGS = "AAAA,SAAS,EAAS,GAChB"

type ShippedMap = {
  names: string[]
  mappings: string
  sourcesContent?: unknown
  sections?: { map: ShippedMap }[]
}

function ship(map: Record<string, unknown>): ShippedMap {
  return JSON.parse(toShippedSourceMap(JSON.stringify(map), GENERATED) ?? "null") as ShippedMap
}

// The name each segment of the first generated line carries, keyed by generated column.
function namesByColumn(map: ShippedMap): Record<number, string | null> {
  const [segments = []] = decodeMappings(map.mappings)

  return Object.fromEntries(
    segments.map(([column = 0, , , , nameIndex]) => [
      column,
      nameIndex === undefined ? null : (map.names[nameIndex] ?? null)
    ])
  )
}

const UNNAMED_MAP = {
  version: 3,
  sources: ["../../lib/allocate.ts"],
  sourcesContent: [SOURCE],
  names: [],
  mappings: UNNAMED_MAPPINGS
}

test("names every renamed identifier from the source text before dropping the text", () => {
  const shipped = ship(UNNAMED_MAP)

  expect(shipped.sourcesContent).toBeUndefined()
  expect(namesByColumn(shipped)).toMatchObject({ 9: "allocate", 11: "counter" })
})

test("leaves a segment whose identifier the minifier did not rename without a name", () => {
  expect(namesByColumn(ship(UNNAMED_MAP))).toMatchObject({ 0: null, 14: null })
})

test("keeps the names a map already carries", () => {
  const shipped = ship({
    version: 3,
    sources: ["../../lib/allocate.ts"],
    names: ["allocate"],
    mappings: "AAAA,SAASA"
  })

  expect(namesByColumn(shipped)).toMatchObject({ 9: "allocate" })
})

test("names and strips the source text inside every section of an index map", () => {
  const shipped = ship({
    version: 3,
    sections: [{ offset: { line: 0, column: 0 }, map: UNNAMED_MAP }]
  })

  const section = shipped.sections?.[0]?.map

  expect(section?.sourcesContent).toBeUndefined()
  expect(section ? namesByColumn(section) : {}).toMatchObject({ 9: "allocate" })
})

test.each([
  ["text that is not JSON", "not json"],
  ["a JSON value that is not a map", "[1, 2]"]
])("refuses %s rather than shipping it", (_shape, payload) => {
  expect(toShippedSourceMap(payload, GENERATED)).toBeNull()
})
