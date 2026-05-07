import { describe, expect, test, vi } from "vitest"

import { emit, on } from "@/lib/events/bus"

describe("event bus", () => {
  test("calls a registered handler with the emitted payload", async () => {
    const handler = vi.fn()

    on("settings.email.configured", handler)
    await emit("settings.email.configured", { userId: "user-abc" })

    expect(handler).toHaveBeenCalledOnce()
    expect(handler).toHaveBeenCalledWith({ userId: "user-abc" })
  })

  test("calls all registered handlers when multiple are registered for the same event", async () => {
    const first = vi.fn()
    const second = vi.fn()

    on("settings.payment.configured", first)
    on("settings.payment.configured", second)
    await emit("settings.payment.configured", { userId: "user-xyz" })

    expect(first).toHaveBeenCalledOnce()
    expect(second).toHaveBeenCalledOnce()
  })
})
