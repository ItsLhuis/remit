export type StackFrame = {
  filename: string
  function?: string
  lineno: number
  colno: number
  in_app: boolean
}

const MAX_FRAMES = 50

// V8's two frame shapes, `at <function> (<location>:<line>:<column>)` and
// `at [async ]<location>:<line>:<column>` — the second is how an anonymous function prints, with
// `async` when it was awaited. A frame with no position, such as `at Array.map (<anonymous>)`,
// matches neither and is skipped.
const FRAME_PATTERN = /^\s+at (?:(.+?) \((.+):(\d+):(\d+)\)|(?:async )?(.+):(\d+):(\d+))$/

// What a function name or a location may contain once parsed. Both come from code rather than from
// data, but the check is what keeps that true: anything outside it — an `eval` origin, a name built
// at runtime — is dropped rather than trusted.
const FUNCTION_NAME_PATTERN = /^[\w$.<>[\] ]{1,160}$/
const FILENAME_PATTERN = /^[\w@~+.\-/[\]()]{1,300}$/
const NODE_BUILTIN_PATTERN = /^node:[\w/.-]{1,200}$/

// Frames are read only from below the stack's header, never from the whole string. V8 renders the
// header as `String(error)` — the name and the whole message — when `stack` is first read, so a
// message can span lines, and a message that carries `\n    at x (y:1:2)` would otherwise be read
// as a frame and sent. When the header no longer matches the error, because its message or name
// changed after the stack was rendered, the boundary between header and frames is unknowable and
// no frame is returned.
export function parseStackFrames(error: Error, cwd: string): StackFrame[] {
  const rendered = renderStack(error)

  if (!rendered?.stack.startsWith(`${rendered.header}\n`)) return []

  const { stack, header } = rendered

  const normalizedCwd = normalizePath(cwd)

  return stack
    .slice(header.length + 1)
    .split("\n")
    .slice(0, MAX_FRAMES)
    .flatMap((line) => {
      const frame = toStackFrame(line, normalizedCwd)

      return frame ? [frame] : []
    })
    .reverse()
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

function toStackFrame(line: string, cwd: string): StackFrame | null {
  const match = FRAME_PATTERN.exec(line)

  if (!match) return null

  const functionName = match[1]
  const location = match[2] ?? match[5]
  const lineno = Number(match[3] ?? match[6])
  const colno = Number(match[4] ?? match[7])

  const filename = toSafeFilename(location, cwd)

  if (!filename) return null

  return {
    filename,
    ...(functionName && FUNCTION_NAME_PATTERN.test(functionName) ? { function: functionName } : {}),
    lineno,
    colno,
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
