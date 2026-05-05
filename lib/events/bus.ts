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

  for (const handler of handlers) {
    await handler(payload)
  }
}
