import { type EventMap } from "./types"

type Handler<E extends keyof EventMap> = (payload: EventMap[E]) => Promise<void> | void

const registry = new Map<keyof EventMap, Handler<keyof EventMap>[]>()

export function on<E extends keyof EventMap>(
  event: E,
  handler: (payload: EventMap[E]) => Promise<void> | void
): void {
  const existing = registry.get(event) ?? []

  existing.push(handler as Handler<keyof EventMap>)
  registry.set(event, existing)
}

export async function emit<E extends keyof EventMap>(
  event: E,
  payload: EventMap[E]
): Promise<void> {
  const handlers = (registry.get(event) ?? []) as Handler<E>[]

  // Nothing is caught here on purpose, so a throwing handler rejects the emitting action's write
  // path. `.agents/rules/events.md` therefore requires every handler to catch and log its own
  // failures; the bus does not paper over one that does not.
  await Promise.all(handlers.map((handler) => Promise.resolve(handler(payload))))
}
