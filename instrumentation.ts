import { type Instrumentation } from "next"

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return

  // Env must validate first (its import has boot-time side effects); the remaining imports are
  // independent of each other, so load them together.
  const { env } = await import("@/lib/config/env")

  // Error tracking starts from the validated `env` and only after it, never from `process.env`. A
  // failed validation exits inside the import above, so no sender exists at the one moment an error
  // carries the environment it was validating — which is why this cannot move above that import to
  // report boot failures. With no DSN nothing is imported or constructed at all.
  if (env.SENTRY_DSN) {
    const [{ startErrorTracking }, { default: pkg }] = await Promise.all([
      import("@/lib/errorTracking"),
      import("@/package.json")
    ])

    startErrorTracking({
      dsn: env.SENTRY_DSN,
      runtime: "server",
      release: pkg.version,
      environment: env.NODE_ENV
    })
  }

  // The activity module is imported for its side effect: it subscribes to the domain events that
  // belong in the user-facing feed at module load, the way `scripts/worker.ts` imports the feature
  // job modules. Nothing under `lib/` may import a feature, so this hook is the server runtime's
  // only place to wire a bus subscriber. `lib/events/bus.ts` holds its registry on `globalThis`
  // precisely because this file is compiled into its own bundle. The webhooks module subscribes for
  // the same reason, queueing a delivery for every event an endpoint is subscribed to.
  const [{ logger }, { ensureBucket }] = await Promise.all([
    import("@/lib/logger"),
    import("@/lib/storage/s3"),
    import("@/features/activityLog/events"),
    import("@/features/webhooks/events")
  ])

  try {
    await ensureBucket()
  } catch (error) {
    logger.error(
      { action: "instrumentation.register", service: "s3", err: error },
      "Failed to ensure bucket exists"
    )
  }
}

// Next.js calls this for an error that escapes a server component, a route handler, a server action
// or the proxy — the request half of the report-versus-log rule in `.agents/rules/errors.md`. The
// request's path and headers are never read: the path carries ids and public tokens, the headers
// carry the session cookie. The browser has no counterpart on purpose; there is no
// `instrumentation-client.ts`. A client-side handler sees form state, URL parameters and rendered
// line items, and reaching a receiver from the browser would mean handing it the DSN.
export const onRequestError: Instrumentation.onRequestError = async (error, _request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return

  const [{ reportError }, { logger }] = await Promise.all([
    import("@/lib/errorTracking"),
    import("@/lib/logger")
  ])

  const errorEventId = reportError(error, {
    source: "request",
    routePath: context.routePath,
    routeType: context.routeType,
    renderSource: context.renderSource
  })

  if (!errorEventId) return

  logger.error(
    { action: "request.error", errorEventId, routePath: context.routePath, err: error },
    "Request error reported"
  )
}
