import { decodeMappings, encodeMappings } from "@/lib/errorTracking/sourceMapCodec"

const IDENTIFIER_PATTERN = /[A-Za-z_$][\w$]*/y

type SourceMapPayload = {
  sources?: unknown
  sourcesContent?: unknown
  names?: unknown
  mappings?: unknown
  sections?: unknown
  [key: string]: unknown
}

// A source map as the image ships it: the mappings, names and source paths
// `lib/errorTracking/sourceMaps.ts` needs to turn a chunk position into a source one, and none of
// the original source text. `sourcesContent` is two thirds of every map Turbopack writes, and
// nothing in the image reads it, so it would only enlarge the image and put every bundled
// dependency's source on every host that runs it.
//
// Turbopack's maps name nothing: a binding the minifier renamed (`getPublicInvoice` to `A`,
// `DrizzleQueryError` to `ce`) maps to the right source position with no record of what it was
// called, so an error event could say where it happened but not in what. The source text is still
// here at build time, so before it is dropped each segment that starts a renamed identifier gets
// the source's name for it, the field the source map format defines for exactly this. A segment
// whose generated and source identifiers already agree needs no name and gets none.
export function toShippedSourceMap(payload: string, generatedSource: string): string | null {
  let map: unknown

  try {
    map = JSON.parse(payload)
  } catch {
    return null
  }

  if (typeof map !== "object" || map === null || Array.isArray(map)) return null

  return JSON.stringify(shipMap(map as SourceMapPayload, generatedSource.split("\n"), 0, 0))
}

function shipMap(
  map: SourceMapPayload,
  generatedLines: string[],
  lineOffset: number,
  columnOffset: number
): SourceMapPayload {
  const { sourcesContent, ...shipped } = map

  if (Array.isArray(map.sections)) {
    shipped.sections = map.sections.map((section: unknown) => shipSection(section, generatedLines))

    return shipped
  }

  if (typeof map.mappings !== "string" || !Array.isArray(sourcesContent)) return shipped

  const names = Array.isArray(map.names) ? [...(map.names as unknown[])] : []
  const nameIndexes = new Map(names.map((name, index) => [String(name), index]))
  const sourceLines = sourcesContent.map((content) =>
    typeof content === "string" ? content.split(/\r?\n/) : null
  )

  const lines = decodeMappings(map.mappings).map((segments, line) =>
    segments.map((segment) => {
      if (segment.length !== 4) return segment

      const [column, source, originalLine, originalColumn] = segment
      const generatedLine = generatedLines[line + lineOffset] ?? ""
      const generated = readIdentifier(generatedLine, column + (line === 0 ? columnOffset : 0))
      const original = readIdentifier(sourceLines[source]?.[originalLine] ?? "", originalColumn)

      if (!generated || !original || generated === original) return segment

      let nameIndex = nameIndexes.get(original)

      if (nameIndex === undefined) {
        nameIndex = names.length
        names.push(original)
        nameIndexes.set(original, nameIndex)
      }

      return [...segment, nameIndex]
    })
  )

  return { ...shipped, names, mappings: encodeMappings(lines) }
}

// An index map's sections each carry a whole map placed at an offset into the generated file.
function shipSection(section: unknown, generatedLines: string[]): unknown {
  if (typeof section !== "object" || section === null) return section

  const { offset, map } = section as { offset?: { line?: number; column?: number }; map?: unknown }

  if (typeof map !== "object" || map === null) return section

  return {
    ...section,
    map: shipMap(map as SourceMapPayload, generatedLines, offset?.line ?? 0, offset?.column ?? 0)
  }
}

function readIdentifier(line: string, column: number): string | null {
  IDENTIFIER_PATTERN.lastIndex = column

  return IDENTIFIER_PATTERN.exec(line)?.[0] ?? null
}
