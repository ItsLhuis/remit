import { type ErrorEvent } from "./errorEvent"

export const ENVELOPE_CONTENT_TYPE = "application/x-sentry-envelope"

// The Sentry envelope framing, which GlitchTip accepts on the same endpoint: an envelope header, an
// item header and the event, one JSON document per line. The envelope header carries no `dsn`,
// though the format recommends one, because the key already travels in `X-Sentry-Auth` and a
// payload that names its own credential is one more place for it to be copied from.
export function serializeEnvelope(event: ErrorEvent, sentAt: Date): string {
  return [
    JSON.stringify({ event_id: event.event_id, sent_at: sentAt.toISOString() }),
    JSON.stringify({ type: "event" }),
    JSON.stringify(event)
  ].join("\n")
}
