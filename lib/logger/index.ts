import pino from "pino"

import { env } from "@/lib/env"

const isDevelopment = env.NODE_ENV === "development"

export const logger = pino({
  level: "info",
  ...(isDevelopment && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        ignore: "pid,hostname"
      }
    }
  })
})

export function withRequestId(requestId: string) {
  return logger.child({ requestId })
}
