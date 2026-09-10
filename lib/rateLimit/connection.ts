import IORedis from "ioredis"

// Deliberately not `lib/jobs/connection.ts`'s factory. That one sets `maxRetriesPerRequest: null`
// so BullMQ's blocking commands wait out any outage, which on a request path would hold every public
// request open for as long as Redis is down. This client gives up fast instead: a command is
// abandoned after `COMMAND_TIMEOUT_MS`, and whatever queued while the socket was down is flushed
// after one failed reconnect, so `redisAdapter.ts` can fall back while the caller is still waiting.
//
// A command abandoned by the timeout can still reach Redis if the socket returns before ioredis
// flushes it, so a counter may include a few requests the fallback already served. That errs towards
// refusing early; it can never let a burst through.
const COMMAND_TIMEOUT_MS = 500
const CONNECT_TIMEOUT_MS = 2_000

let connection: Promise<IORedis> | null = null

export function createRateLimitConnection(redisUrl: string): IORedis {
  const client = new IORedis(redisUrl, {
    maxRetriesPerRequest: 1,
    commandTimeout: COMMAND_TIMEOUT_MS,
    connectTimeout: CONNECT_TIMEOUT_MS
  })

  // Silent on purpose: ioredis emits `error` on every reconnect attempt, and `redisAdapter.ts`
  // already logs the outage when it starts and when it ends. A listener must exist either way, or
  // ioredis prints every attempt as an unhandled error event.
  client.on("error", () => undefined)

  return client
}

// Lazy like `lib/jobs/queue.ts`'s `getQueue`: `proxy.ts` and every rate-limited route import this
// module, and a socket opened at import time would connect during `next build`. The environment is
// imported lazily too, on first use: `lib/config/env.ts` exits the process when validation fails, and
// a static import here would make importing `proxy.ts` — which its own tests do — validate the whole
// deployment environment first.
export function getRateLimitConnection(): Promise<IORedis> {
  connection ??= import("@/lib/config/env").then(({ env }) =>
    createRateLimitConnection(env.REDIS_URL)
  )

  return connection
}
