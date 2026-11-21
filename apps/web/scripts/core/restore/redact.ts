import { redactOperationalError } from "../cli/redact"

export function redactRestoreReason(error: unknown): string {
  return redactOperationalError(error, { stripStackFrames: true })
}
