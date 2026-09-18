import { z } from "zod"

import { parseStackFrames, type StackFrame } from "./stackFrames"

export type ErrorTrackingRuntime = "server" | "worker"

// What the boundary that caught an error knows about where it happened. Every field is checked
// against a closed vocabulary before it is used, so a caller cannot widen what an event carries by
// passing more.
export type ErrorReportContext =
  | {
      source: "request"
      routePath: string
      routeType: string
      renderSource?: string
    }
  | { source: "job"; jobName: string; attempts: number }
  | { source: "process"; phase: "start" }

export type ErrorEventCandidate = {
  error: unknown
  context: ErrorReportContext
}

export type ErrorEventFacts = {
  eventId: string
  timestamp: number
  release: string
  environment: string
  runtime: ErrorTrackingRuntime
  cwd: string
}

type ExceptionValue = {
  type: string
  value: string
  stacktrace?: { frames: StackFrame[] }
  mechanism?: { type: string; handled: false }
}

export type ErrorEvent = {
  event_id: string
  timestamp: number
  platform: "node"
  level: "error"
  release: string
  environment: string
  transaction: string
  tags: Record<string, string>
  exception: { values: ExceptionValue[] }
  sdk: { name: string; version: string }
}

// The one text an exception's value ever carries. A message is free text assembled by whatever
// threw it — a driver error quotes the column values it failed on, a validation error can quote its
// input — so no rule could classify it, and it stays in the instance log that records the same
// event id.
export const WITHHELD_MESSAGE =
  "Message withheld by Remit. The instance log records it under this event's errorEventId tag."

const MAX_CAUSE_DEPTH = 5

const MECHANISM_TYPES = {
  request: "remit.request",
  job: "remit.job",
  process: "remit.process"
} as const

const ERROR_TYPE_PATTERN = /^[A-Za-z_$][\w$]{0,63}$/

// SQLSTATE (`23505`), a system error (`ECONNREFUSED`), or a Node or undici error code
// (`ERR_INVALID_URL`, `UND_ERR_CONNECT_TIMEOUT`). Each names a class of failure from a closed set
// and says nothing about the data involved.
const ERROR_CODE_PATTERN = /^(?:[0-9A-Z]{5}|E[A-Z]{2,15}|ERR_[A-Z_]{1,60}|UND_ERR_[A-Z_]{1,40})$/

// Next.js's digest is a numeric hash of the error, optionally suffixed with its own error code. It
// is the key that ties the event to the line Next.js writes to the log and to the digest the error
// page shows the user.
const DIGEST_PATTERN = /^\d{1,20}(?:@E\d{1,6})?$/

// A route pattern such as `/invoices/[invoiceId]`, which is what Next.js passes as `routePath`. The
// check is the guarantee that only a pattern, never a requested path, becomes a tag: a static
// segment is a short lowercase word, so an id, a token or an email address in its place fails it.
const ROUTE_SEGMENT_PATTERN =
  /^(?:\[{1,2}(?:\.\.\.)?[A-Za-z]\w{0,39}\]{1,2}|\([a-z][\w-]{0,39}\)|@[a-z][\w-]{0,39}|[a-z][a-z0-9.-]{0,39})$/
const HEX_RUN_PATTERN = /[0-9a-f]{8}/

const JOB_NAME_PATTERN = /^[a-z][a-z_]*(?:\.[a-z_]+){1,4}$/

const RELEASE_PATTERN = /^\d{1,4}\.\d{1,4}\.\d{1,6}(?:-[0-9A-Za-z.-]{1,32})?$/

const routePathSchema = z
  .string()
  .max(200)
  .refine((value) => {
    if (!value.startsWith("/")) return false

    return value
      .slice(1)
      .split("/")
      .every((segment) => ROUTE_SEGMENT_PATTERN.test(segment) && !HEX_RUN_PATTERN.test(segment))
  })

const contextSchema = z.discriminatedUnion("source", [
  z.strictObject({
    source: z.literal("request"),
    routePath: routePathSchema,
    routeType: z.enum(["render", "route", "action", "proxy"]),
    renderSource: z
      .enum(["react-server-components", "react-server-components-payload", "server-rendering"])
      .optional()
  }),
  z.strictObject({
    source: z.literal("job"),
    jobName: z.string().regex(JOB_NAME_PATTERN),
    attempts: z.number().int().min(1).max(100)
  }),
  z.strictObject({
    source: z.literal("process"),
    phase: z.literal("start")
  })
])

const factsSchema = z.strictObject({
  eventId: z.string().regex(/^[0-9a-f]{32}$/),
  timestamp: z.number().positive(),
  release: z.string().regex(RELEASE_PATTERN),
  environment: z.enum(["development", "production", "test"]),
  runtime: z.enum(["server", "worker"]),
  cwd: z.string()
})

type ValidContext = z.infer<typeof contextSchema>

// The scrubbing boundary, and the only producer of what leaves the instance. It does not remove
// fields from an error: it builds a new event from nothing, adding only values it can classify —
// an error's type, its code, its stack frames, and the boundary's own closed-vocabulary context —
// so a field nobody thought about is absent by construction rather than by someone remembering to
// delete it.
//
// It fails closed. A context or a fact that does not match its vocabulary drops the whole event
// rather than the field, because an unexpected value is evidence the caller is not what this
// function was written for, and the one outcome that cannot leak is sending nothing. That reads as
// over-strict until the day it is loosened and a requested path, with its token, becomes a tag.
export function buildErrorEvent(
  candidate: ErrorEventCandidate,
  facts: ErrorEventFacts
): ErrorEvent | null {
  const context = contextSchema.safeParse(candidate.context)
  const validFacts = factsSchema.safeParse(facts)

  if (!context.success || !validFacts.success) return null

  const chain = collectErrorChain(candidate.error)
  const exceptions = chain.map((error) => toExceptionValue(error, validFacts.data.cwd)).reverse()
  const outermost = exceptions.at(-1)

  if (outermost) {
    outermost.mechanism = { type: MECHANISM_TYPES[context.data.source], handled: false }
  }

  const code = chain.map(readErrorCode).find((value) => value !== null)
  const digest = context.data.source === "request" ? readDigest(candidate.error) : null

  return {
    event_id: validFacts.data.eventId,
    timestamp: validFacts.data.timestamp,
    platform: "node",
    level: "error",
    release: `remit@${validFacts.data.release}`,
    environment: validFacts.data.environment,
    transaction: toTransaction(context.data),
    // The event id again, as a tag named for the log field that carries it: a receiver may show its
    // own id for an event rather than this one (GlitchTip does), and the tag is what an operator
    // reads to find the log line holding everything the event withholds.
    tags: {
      errorEventId: validFacts.data.eventId,
      runtime: validFacts.data.runtime,
      source: context.data.source,
      ...toContextTags(context.data),
      ...(code ? { "error.code": code } : {}),
      ...(digest ? { digest } : {})
    },
    exception: { values: exceptions },
    sdk: { name: "remit.error-tracking", version: validFacts.data.release }
  }
}

// The error and its `cause` chain, outermost first, stopping at a cycle or at the depth limit.
function collectErrorChain(error: unknown): unknown[] {
  const chain: unknown[] = []
  const seen = new Set<unknown>()

  let current: unknown = error

  while (current !== undefined && current !== null && chain.length < MAX_CAUSE_DEPTH) {
    if (seen.has(current)) break

    seen.add(current)
    chain.push(current)

    current = current instanceof Error ? readProperty(current, "cause") : undefined
  }

  return chain
}

function toExceptionValue(error: unknown, cwd: string): ExceptionValue {
  if (!(error instanceof Error)) return { type: "NonError", value: WITHHELD_MESSAGE }

  const frames = parseStackFrames(error, cwd)

  return {
    type: readErrorType(error),
    value: WITHHELD_MESSAGE,
    ...(frames.length > 0 ? { stacktrace: { frames } } : {})
  }
}

function readErrorType(error: Error): string {
  const name = readProperty(error, "name")

  return typeof name === "string" && ERROR_TYPE_PATTERN.test(name) ? name : "Error"
}

function readErrorCode(error: unknown): string | null {
  const code = readProperty(error, "code")

  return typeof code === "string" && ERROR_CODE_PATTERN.test(code) ? code : null
}

function readDigest(error: unknown): string | null {
  const digest = readProperty(error, "digest")

  return typeof digest === "string" && DIGEST_PATTERN.test(digest) ? digest : null
}

// A getter on a thrown object can itself throw, and nothing here is allowed to.
function readProperty(value: unknown, key: string): unknown {
  if (typeof value !== "object" || value === null) return undefined

  try {
    return (value as Record<string, unknown>)[key]
  } catch {
    return undefined
  }
}

function toTransaction(context: ValidContext): string {
  switch (context.source) {
    case "request":
      return context.routePath
    case "job":
      return context.jobName
    case "process":
      return `process.${context.phase}`
  }
}

function toContextTags(context: ValidContext): Record<string, string> {
  switch (context.source) {
    case "request":
      return {
        "route.path": context.routePath,
        "route.type": context.routeType,
        ...(context.renderSource ? { "route.render_source": context.renderSource } : {})
      }
    case "job":
      return { "job.name": context.jobName, "job.attempts": String(context.attempts) }
    case "process":
      return { "process.phase": context.phase }
  }
}
