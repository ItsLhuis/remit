import { readFileSync } from "node:fs"
import { dirname, isAbsolute, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"

import { decodeMappings, type MappingSegment } from "./sourceMapCodec"

export type OriginalPosition = {
  file: string
  line: number
  column: number
}

export type GeneratedPosition = {
  file: string
  line: number
  column: number
}

export type GeneratedFrame = GeneratedPosition & { minifiedName: string }

export type SourceMapResolver = {
  // A generated position — 1-based, as V8 prints it — in a source-mapped bundle, translated to the
  // file, line and column it was compiled from. Null for a file with no map, or a position the map
  // does not cover.
  resolvePosition(file: string, line: number, column: number): OriginalPosition | null
  // The name the source gave the function a frame is executing, from its minified one.
  resolveFunctionName(frame: GeneratedFrame, caller: GeneratedPosition | null): string | null
  // The name the source gave an error's class, when the bundle minified it. Null when it cannot be
  // recovered, which the caller must treat as "unknown" rather than fall back to the minified name.
  resolveClassName(error: Error, frameFiles: string[]): string | null
  // Whether a file is a bundle that ships a map, and so one whose identifiers are minified.
  isMapped(file: string): boolean
}

type Mapping = {
  source: string
  line: number
  column: number
  name: string | null
}

// One map, or one section of an index map, placed at its offset into the generated file.
type MapSection = {
  line: number
  column: number
  sources: string[]
  names: string[]
  lines: MappingSegment[][]
}

type LoadedChunk = {
  sections: MapSection[]
  source: () => string
}

// Enough for every chunk one request's stack can pass through, so a burst of errors on one route
// parses each map once; small, because a parsed map is several times its file's size in memory.
const MAX_CACHED_CHUNKS = 32

// Server frames point into minified Turbopack chunks under `.next/server`, and the image ships each
// chunk's map beside it (`scripts/ship-server-source-maps.ts`, run by the Dockerfile's builder
// stage). This turns a chunk position back into the source file, line and column it came from,
// and a minified function or class name back into the one the source gave it, before
// `buildErrorEvent` builds the event. It reads only maps, and only beside a `.js` file under the
// working directory: the path comes from a V8 stack frame, so it names code, never data. A map's
// `sourcesContent` is never read, and nothing it yields leaves except through `stackFrames.ts`,
// which still holds every filename and name to its allowlist patterns.
//
// Resolving here, at the one moment an error is reported, was chosen over enabling Node's own
// source-map support for the process (`--enable-source-maps`): that keeps every loaded chunk's map
// in memory for the life of the process and maps every stack any code renders, to serve the rare
// error that is reported. Uploading the maps to the receiver instead would need the operator's
// credential at build time, and a published image is built before any operator configures one.
export function createSourceMapResolver(cwd: string): SourceMapResolver {
  const root = resolve(cwd)
  const chunks = new Map<string, LoadedChunk | null>()

  function loadChunk(file: string): LoadedChunk | null {
    const path = toChunkPath(file, root)

    if (!path) return null

    if (chunks.has(path)) return chunks.get(path) ?? null

    const chunk = readChunk(path)

    if (chunks.size >= MAX_CACHED_CHUNKS) {
      const oldest = chunks.keys().next().value

      if (oldest !== undefined) chunks.delete(oldest)
    }

    chunks.set(path, chunk)

    return chunk
  }

  function nameAt(file: string, line: number, column: number): string | null {
    const chunk = loadChunk(file)

    return chunk ? (findMapping(chunk, line, column)?.name ?? null) : null
  }

  return {
    resolvePosition(file, line, column) {
      const chunk = loadChunk(file)
      const mapping = chunk ? findMapping(chunk, line, column) : null

      if (!mapping) return null

      const original = toOriginalPath(mapping.source, file)

      if (!original) return null

      return { file: original, line: mapping.line + 1, column: mapping.column + 1 }
    },

    resolveFunctionName({ file, line, column, minifiedName }, caller) {
      const chunk = loadChunk(file)

      if (!chunk) return null

      // The definition first: the nearest `function <name>(` before the frame's position is the
      // function it is executing, and the map names that identifier. A minified name is reused
      // across scopes, so only the nearest preceding definition is taken. Failing that, the caller's
      // own call expression names the function it called, which is what Node's source-map support
      // falls back to as well.
      const definition = findDefinition(chunk.source(), minifiedName, line, column)
      const definedName = definition ? nameAt(file, definition.line, definition.column) : null

      if (definedName) return definedName

      return caller ? nameAt(caller.file, caller.line, caller.column) : null
    },

    resolveClassName(error, frameFiles) {
      const constructor = readConstructor(error)

      if (!constructor) return null

      const mapped = frameFiles.filter((file) => loadChunk(file) !== null)
      const declaration = Function.prototype.toString.call(constructor)

      if (mapped.length === 0) return readUnbundledClassName(constructor, declaration, frameFiles)

      for (const file of new Set(mapped)) {
        const chunk = loadChunk(file)
        const position = chunk ? findClassName(chunk.source(), declaration, constructor.name) : null

        if (position) {
          const name = nameAt(file, position.line, position.column)

          if (name) return name
        }
      }

      return null
    },

    isMapped(file) {
      return loadChunk(file) !== null
    }
  }
}

function toChunkPath(file: string, root: string): string | null {
  const path = file.startsWith("file://") ? fileURLToPath(file) : file

  if (!isAbsolute(path) || !path.endsWith(".js")) return null

  const absolute = resolve(path)

  return absolute.startsWith(`${root}${sep}`) ? absolute : null
}

function readChunk(path: string): LoadedChunk | null {
  try {
    const sections = toSections(JSON.parse(readFileSync(`${path}.map`, "utf8")), 0, 0)

    if (sections.length === 0) return null

    let source: string | null = null

    return { sections, source: () => (source ??= readFileSync(path, "utf8")) }
  } catch {
    return null
  }
}

function toSections(payload: unknown, line: number, column: number): MapSection[] {
  if (typeof payload !== "object" || payload === null) return []

  const map = payload as Record<string, unknown>

  if (Array.isArray(map.sections)) {
    return map.sections.flatMap((section: unknown) => {
      if (typeof section !== "object" || section === null) return []

      const { offset, map: sectionMap } = section as {
        offset?: { line?: unknown; column?: unknown }
        map?: unknown
      }

      return toSections(
        sectionMap,
        typeof offset?.line === "number" ? offset.line : 0,
        typeof offset?.column === "number" ? offset.column : 0
      )
    })
  }

  if (typeof map.mappings !== "string" || !Array.isArray(map.sources)) return []

  return [
    {
      line,
      column,
      sources: map.sources.map(String),
      names: Array.isArray(map.names) ? map.names.map(String) : [],
      lines: decodeMappings(map.mappings)
    }
  ]
}

// The segment covering a generated position (1-based, as V8 prints it): the last one at or before
// the column on that same line. A line with no segment before the column is not covered, rather
// than borrowed from an earlier line, which would name the wrong source line.
function findMapping(chunk: LoadedChunk, line: number, column: number): Mapping | null {
  const generatedLine = line - 1
  const generatedColumn = column - 1

  const section = chunk.sections.findLast(
    (candidate) =>
      candidate.line < generatedLine ||
      (candidate.line === generatedLine && candidate.column <= generatedColumn)
  )

  if (!section) return null

  const relativeLine = generatedLine - section.line
  const relativeColumn = relativeLine === 0 ? generatedColumn - section.column : generatedColumn

  const segment = (section.lines[relativeLine] ?? []).findLast(
    (candidate) => (candidate[0] ?? Infinity) <= relativeColumn
  )

  if (!segment || segment.length < 4) return null

  const [, sourceIndex = 0, originalLine = 0, originalColumn = 0, nameIndex] = segment
  const source = section.sources[sourceIndex]

  if (source === undefined) return null

  return {
    source,
    line: originalLine,
    column: originalColumn,
    name: nameIndex === undefined ? null : (section.names[nameIndex] ?? null)
  }
}

// A map's sources are URLs relative to the map, percent-encoded (`%40better-auth`). One with a
// scheme other than `file:` names something that is not on this disk and is dropped.
function toOriginalPath(source: string, chunkFile: string): string | null {
  try {
    if (source.startsWith("file://")) return fileURLToPath(source)

    if (/^[a-z][a-z0-9+.-]*:/i.test(source)) return null

    const chunkPath = chunkFile.startsWith("file://") ? fileURLToPath(chunkFile) : chunkFile

    return resolve(dirname(chunkPath), decodeURIComponent(source))
  } catch {
    return null
  }
}

function findDefinition(
  source: string,
  minifiedName: string,
  line: number,
  column: number
): { line: number; column: number } | null {
  if (!/^[\w$]+$/.test(minifiedName)) return null

  const offset = toOffset(source, line, column)

  if (offset === null) return null

  const definition = source.lastIndexOf(`function ${minifiedName}(`, offset)

  if (definition < 0) return null

  return toPosition(source, definition + "function ".length)
}

// The position of the identifier the bundle gave the class: after `class ` for a declaration
// (`class ce extends Error`), or the variable a class expression is assigned to
// (`var o=class extends Error`), which is the form esbuild writes.
function findClassName(
  source: string,
  declaration: string,
  minifiedName: string
): { line: number; column: number } | null {
  const at = source.indexOf(declaration)

  if (at < 0) return null

  const named = /^class\s+(?!extends\b)[\w$]/.exec(declaration)

  if (named) return toPosition(source, at + named[0].length - 1)

  const assigned = `${minifiedName}=`

  if (source.slice(at - assigned.length, at) === assigned) {
    return toPosition(source, at - assigned.length)
  }

  return null
}

// No frame runs in a mapped bundle. The constructor's own name is trusted only when its declaration
// spells it (`class DrizzleQueryError extends Error`), which is how the worker's bundle and every
// dependency loaded from `node_modules` keep theirs; a minifier's class expression bound to a short
// variable (`var o=class extends Error`) takes the variable's name instead. A Next.js chunk with no
// map beside it is minified even when it declares a name, and an error with no frames says nothing
// about where its class lives, so both stay unknown.
function readUnbundledClassName(
  constructor: abstract new () => unknown,
  declaration: string,
  frameFiles: string[]
): string | null {
  const isUnbundled =
    frameFiles.length > 0 &&
    !frameFiles.some((file) => file.replaceAll("\\", "/").includes("/.next/"))

  return isUnbundled && declaration.startsWith(`class ${constructor.name} `)
    ? constructor.name
    : null
}

function readConstructor(error: Error): (abstract new () => unknown) | null {
  try {
    const prototype: unknown = Object.getPrototypeOf(error)
    const constructor: unknown =
      typeof prototype === "object" && prototype !== null ? prototype.constructor : undefined

    if (typeof constructor !== "function" || constructor === Error) return null

    return constructor as abstract new () => unknown
  } catch {
    return null
  }
}

function toOffset(source: string, line: number, column: number): number | null {
  let offset = 0

  for (let current = 1; current < line; current += 1) {
    const next = source.indexOf("\n", offset)

    if (next < 0) return null

    offset = next + 1
  }

  return offset + column - 1
}

function toPosition(source: string, offset: number): { line: number; column: number } {
  let line = 1
  let lineStart = 0

  for (let index = source.indexOf("\n"); index >= 0 && index < offset; ) {
    line += 1
    lineStart = index + 1
    index = source.indexOf("\n", lineStart)
  }

  return { line, column: offset - lineStart + 1 }
}
