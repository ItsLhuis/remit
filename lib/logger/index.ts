import pino from "pino"

// Read straight from `process.env` rather than through `lib/config/env.ts`, which is the rule
// everywhere else: that module imports this one to report a validation failure, so reading `env`
// here would close an import cycle and leave the logger undefined at the moment it is needed most.
const isDevelopment = process.env.NODE_ENV === "development"

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
