import { type EventMap } from "./types"

type Handler<E extends keyof EventMap> = (payload: EventMap[E]) => Promise<void> | void

type HandlerRegistry = Map<keyof EventMap, Handler<keyof EventMap>[]>

const REGISTRY_KEY: unique symbol = Symbol.for("remit.events.registry")

type RegistryHolder = { [REGISTRY_KEY]?: HandlerRegistry }

// Held on `globalThis` rather than in this module's scope because the subscriber and the emitter do
// not always share a module graph. `instrumentation.ts` is the only thing that imports a
// `features/*/events.ts` subscriber in the Next server runtime, and Next compiles it into its own
// bundle loaded through a separate `require()` from the one route and server-action modules come
// from. A module-local Map would hand that bundle a private registry, so every handler registered at
// boot would be invisible to the actions that emit. One process, one bus.
const registry: HandlerRegistry = ((globalThis as RegistryHolder)[REGISTRY_KEY] ??= new Map())

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
