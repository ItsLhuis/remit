import IORedis from "ioredis"

import { logger } from "@/lib/logger"

import { env } from "@/lib/config/env"

// BullMQ workers issue blocking commands (BRPOPLPUSH) that must never be given up on, and ioredis
// aborts a command after `maxRetriesPerRequest` attempts by default. BullMQ overrides this to null
// for its own worker connections, but a connection this module hands out is also used by the
// producer half, so it is set here for both rather than relied on per consumer.
export function createRedisConnection(): IORedis {
  const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null })

  connection.on("error", (error) => {
    logger.error({ action: "redis.connection", err: error }, "Redis connection error")
  })

  return connection
}
