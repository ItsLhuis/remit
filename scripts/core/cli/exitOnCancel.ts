import * as p from "@clack/prompts"

export function exitOnCancel<T>(value: T | symbol, message: string): T {
  if (p.isCancel(value)) {
    p.cancel(message)
    process.exit(0)
  }

  return value
}
