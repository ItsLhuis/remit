import * as p from "@clack/prompts"

export function exitOnCancel<T>(value: T | typeof p.CANCEL_SYMBOL, message: string): T {
  if (p.isCancel(value)) {
    p.cancel(message)
    process.exit(0)
  }

  return value
}
