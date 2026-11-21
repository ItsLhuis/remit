import { redactOperationalError } from "../cli/redact"

export function redactRotationReason(error: unknown): string {
  return redactOperationalError(error, { stripStackFrames: true })
}
