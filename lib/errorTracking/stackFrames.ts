import { type SourceMapResolver } from "./sourceMaps"

export type StackFrame = {
  filename: string
  function?: string
  lineno: number
  colno: number
  in_app: boolean
}

type RawFrame = {
  functionName: string | undefined
  location: string
  lineno: number
  colno: number
}

const MAX_FRAMES = 50

// V8's two frame shapes, `at <function> (<location>:<line>:<column>)` and
// `at [async ]<location>:<line>:<column>` — the second is how an anonymous function prints, with
// `async` when it was awaited. A frame with no position, such as `at Array.map (<anonymous>)`,
// matches neither and is skipped.
const FRAME_PATTERN = /^\s+at (?:(.+?) \((.+):(\d+):(\d+)\)|(?:async )?(.+):(\d+):(\d+))$/

// What a function name or a location may contain once parsed. Both come from code rather than from
// data, but the check is what keeps that true: anything outside it — an `eval` origin, a name built
// at runtime — is dropped rather than trusted. A name or a path recovered from a source map is held
// to the same patterns as one read from the stack.
const FUNCTION_NAME_PATTERN = /^[\w$.<>[\] ]{1,160}$/
const FILENAME_PATTERN = /^[\w@~+.\-/[\]()]{1,300}$/
const NODE_BUILTIN_PATTERN = /^node:[\w/.-]{1,200}$/

// The keywords V8 prefixes to a function name, kept around the name a source map recovers.
const FUNCTION_PREFIX_PATTERN = /^((?:async |new )*)(.*)$/

// Frames are read only from below the stack's header, never from the whole string. V8 renders the
// header as `String(error)` — the name and the whole message — when `stack` is first read, so a
// message can span lines, and a message that carries `\n    at x (y:1:2)` would otherwise be read
// as a frame and sent. When the header no longer matches the error, because its message or name
// changed after the stack was rendered, the boundary between header and frames is unknowable and
// no frame is returned.
export function parseStackFrames(
  error: Error,
  cwd: string,
  sourceMaps?: SourceMapResolver
): StackFrame[] {
  const normalizedCwd = normalizePath(cwd)
  const frames = readRawFrames(error)

  return frames
    .flatMap((frame, index) => {
      const mapped = sourceMaps
        ? toMappedFrame(frame, frames[index + 1] ?? null, sourceMaps)
        : frame
      const stackFrame = toStackFrame(mapped, normalizedCwd)

      return stackFrame ? [stackFrame] : []
    })
    .reverse()
}

// The locations an error's frames run in, for `SourceMapResolver.resolveClassName` to search.
export function readFrameLocations(error: Error): string[] {
  return readRawFrames(error).map((frame) => frame.location)
}

function readRawFrames(error: Error): RawFrame[] {
  const rendered = renderStack(error)

  if (!rendered?.stack.startsWith(`${rendered.header}\n`)) return []

  return rendered.stack
    .slice(rendered.header.length + 1)
    .split("\n")
    .slice(0, MAX_FRAMES)
    .flatMap((line) => {
      const match = FRAME_PATTERN.exec(line)

      if (!match) return []

      return [
        {
          functionName: match[1],
          location: match[2] ?? match[5],
          lineno: Number(match[3] ?? match[6]),
          colno: Number(match[4] ?? match[7])
        }
      ]
    })
}

// `stack`, `name` and `message` may all be getters on a thrown object, and any of them can throw.
function renderStack(error: Error): { stack: string; header: string } | null {
  try {
    const stack: unknown = error.stack

    if (typeof stack !== "string") return null

    return { stack, header: Error.prototype.toString.call(error) }
  } catch {
    return null
  }
}

// A frame inside a mapped bundle is reported at its source position, under the name its source
// gave the function. A minified name that cannot be recovered is dropped rather than sent: `a` or
// `ce` would read as a real name. V8 prefixes a function called as a property with its receiver
// (`Object.a` for a bundle's export, `ce.execute` for a method); the receiver is dropped, and the
// property is resolved like any other name, or kept as written when no minified definition
// matches it, because the minifier renames bindings and never property names.
function toMappedFrame(
  frame: RawFrame,
  caller: RawFrame | null,
  sourceMaps: SourceMapResolver
): RawFrame {
  if (!sourceMaps.isMapped(frame.location)) return frame

  const position = sourceMaps.resolvePosition(frame.location, frame.lineno, frame.colno)

  if (!position) return { ...frame, functionName: undefined }

  return {
    functionName: resolveFunctionName(frame, caller, sourceMaps),
    location: position.file,
    lineno: position.line,
    colno: position.column
  }
}

function resolveFunctionName(
  frame: RawFrame,
  caller: RawFrame | null,
  sourceMaps: SourceMapResolver
): string | undefined {
  if (!frame.functionName) return undefined

  const [, prefix = "", qualifiedName = ""] = FUNCTION_PREFIX_PATTERN.exec(frame.functionName) ?? []

  const isProperty = qualifiedName.includes(".")
  const name = qualifiedName.slice(qualifiedName.lastIndexOf(".") + 1)

  const original = sourceMaps.resolveFunctionName(
    { file: frame.location, line: frame.lineno, column: frame.colno, minifiedName: name },
    caller ? { file: caller.location, line: caller.lineno, column: caller.colno } : null
  )

  if (original) return `${prefix}${original}`

  return isProperty ? `${prefix}${name}` : undefined
}

function toStackFrame(frame: RawFrame, cwd: string): StackFrame | null {
  const filename = toSafeFilename(frame.location, cwd)

  if (!filename) return null

  return {
    filename,
    ...(frame.functionName && FUNCTION_NAME_PATTERN.test(frame.functionName)
      ? { function: frame.functionName }
      : {}),
    lineno: frame.lineno,
    colno: frame.colno,
    in_app: !filename.startsWith("node:") && !filename.includes("node_modules")
  }
}

// Paths are made relative to the working directory, so a frame names the file inside the
// application and not the host it runs on. A path outside it is reduced to its last segment: a
// development checkout under a home directory would otherwise send the account name.
function toSafeFilename(location: string, cwd: string): string | null {
  if (NODE_BUILTIN_PATTERN.test(location)) return location

  const path = normalizePath(location.replace(/^file:\/\/\/?/, "/"))
  const comparablePath = path.toLowerCase()
  const comparableCwd = cwd.toLowerCase()

  const relative = comparablePath.startsWith(`${comparableCwd}/`)
    ? path.slice(cwd.length + 1)
    : path.slice(path.lastIndexOf("/") + 1)

  return FILENAME_PATTERN.test(relative) ? relative : null
}

function normalizePath(path: string): string {
  return path
    .replaceAll("\\", "/")
    .replace(/^\/([A-Za-z]:\/)/, "$1")
    .replace(/\/+$/, "")
}
