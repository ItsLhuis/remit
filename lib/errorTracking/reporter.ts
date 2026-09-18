import { randomUUID } from "node:crypto"

import { logger } from "@/lib/logger"

import { parseErrorTrackingDsn, type ErrorTrackingTarget } from "./dsn"
import { ENVELOPE_CONTENT_TYPE, serializeEnvelope } from "./envelope"
import {
  buildErrorEvent,
  type ErrorEvent,
  type ErrorReportContext,
  type ErrorTrackingRuntime
} from "./errorEvent"

export type ErrorTrackingOptions = {
  dsn: string
  runtime: ErrorTrackingRuntime
  release: string
  environment: string
}

type Reporter = {
  target: ErrorTrackingTarget
  runtime: ErrorTrackingRuntime
  release: string
  environment: string
  cwd: string
}

const SEND_TIMEOUT_MS = 5_000

// A failure storm — the database gone and every request throwing — must not become a socket per
// error held open against a receiver that may be down too. An event past this many unanswered
// sends is dropped rather than queued; its error is already in the log under the boundary that
// caught it.
const MAX_IN_FLIGHT = 5

let reporter: Reporter | null = null
let isDeliveryFailing = false

const inFlight = new Set<Promise<void>>()

// Nothing in this module exists until this runs: no client, no connection, no integration. Its two
// callers, `instrumentation.ts` and `scripts/worker.ts`, call it only when `env.SENTRY_DSN` is set
// and take the value from the validated `env`, so a process whose environment failed validation
// has exited inside `lib/config/env.ts` before a sender could exist to transmit that failure.
export function startErrorTracking(options: ErrorTrackingOptions): boolean {
  if (reporter) return true

  const target = parseErrorTrackingDsn(options.dsn)

  if (!target) return false

  reporter = {
    target,
    runtime: options.runtime,
    release: options.release,
    environment: options.environment,
    cwd: process.cwd()
  }

  logger.info({ action: "errorTracking.start", runtime: options.runtime }, "Error tracking enabled")

  return true
}

// The only way an event reaches the network: every error passes through `buildErrorEvent` here, at
// the transport, rather than at each call site, so a capture point added later cannot forget the
// scrubbing — there is no other door. Returns the event id when an event is on its way, for the
// caller's log line, which keeps everything the event withholds. It never throws and never waits
// for the network, because a reporting failure must not fail the request or job it reports on.
export function reportError(error: unknown, context: ErrorReportContext): string | null {
  if (!reporter) return null

  const eventId = randomUUID().replaceAll("-", "")
  const event = buildEventSafely(reporter, eventId, error, context)

  if (!event) {
    logger.warn(
      { action: "errorTracking.report", runtime: reporter.runtime },
      "Error event dropped: it could not be classified"
    )

    return null
  }

  if (inFlight.size >= MAX_IN_FLIGHT) return null

  const sending = deliver(reporter.target, serializeEnvelope(event, new Date()), reporter.release)

  inFlight.add(sending)

  void sending.finally(() => inFlight.delete(sending))

  return eventId
}

// For a process about to exit. Waits for the sends already under way, and never longer than the
// bound: an unreachable receiver must not hold a shutdown open.
export async function flushErrorReports(timeoutMs: number): Promise<void> {
  if (inFlight.size === 0) return

  await Promise.race([
    Promise.allSettled(inFlight),
    new Promise((resolve) => setTimeout(resolve, timeoutMs).unref())
  ])
}

function buildEventSafely(
  activeReporter: Reporter,
  eventId: string,
  error: unknown,
  context: ErrorReportContext
): ErrorEvent | null {
  try {
    return buildErrorEvent(
      { error, context },
      {
        eventId,
        timestamp: Date.now() / 1000,
        release: activeReporter.release,
        environment: activeReporter.environment,
        runtime: activeReporter.runtime,
        cwd: activeReporter.cwd
      }
    )
  } catch {
    return null
  }
}

async function deliver(target: ErrorTrackingTarget, body: string, release: string): Promise<void> {
  try {
    const response = await fetch(target.envelopeUrl, {
      method: "POST",
      headers: {
        "Content-Type": ENVELOPE_CONTENT_TYPE,
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_client=remit/${release}, sentry_key=${target.publicKey}`
      },
      body,
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS)
    })

    await response.body?.cancel()

    if (response.ok) {
      markDeliveryRecovered()

      return
    }

    markDeliveryFailing({ status: response.status })
  } catch (error) {
    markDeliveryFailing({ reason: describeDeliveryFailure(error) })
  }
}

// Logged when delivery starts failing and again when it recovers, never per event: during an outage
// every error would otherwise gain a second line saying it could not be reported. The receiver's
// address is never logged, because it is part of the DSN; only a status or a failure's name is.
function markDeliveryFailing(detail: { status?: number; reason?: string }): void {
  if (isDeliveryFailing) return

  isDeliveryFailing = true

  logger.warn(
    { action: "errorTracking.deliver", ...detail },
    "Error events are not reaching the receiver"
  )
}

function markDeliveryRecovered(): void {
  if (!isDeliveryFailing) return

  isDeliveryFailing = false

  logger.info({ action: "errorTracking.deliver" }, "Error events are reaching the receiver again")
}

// undici reports every connection failure as a `TypeError: fetch failed` whose cause carries the
// system code (`ECONNREFUSED`, `ENOTFOUND`); a timeout arrives as a `TimeoutError`. The message is
// never used, since undici writes the address into it.
function describeDeliveryFailure(error: unknown): string {
  const cause = error instanceof Error ? error.cause : undefined
  const code =
    typeof cause === "object" && cause !== null && "code" in cause ? cause.code : undefined

  if (typeof code === "string" && /^[A-Z_]{2,40}$/.test(code)) return code

  return error instanceof Error && /^\w{1,40}$/.test(error.name) ? error.name : "unknown"
}
