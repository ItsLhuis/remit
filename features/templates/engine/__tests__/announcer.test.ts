import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import {
  announce,
  getAnnouncement,
  resetGestureProgressThrottle,
  shouldAnnounceGestureProgress,
  subscribeToAnnouncer
} from "../announcer"

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"))
})

afterEach(() => {
  vi.useRealTimers()
})

describe("announce", () => {
  test("notifies every subscribed listener", () => {
    const listener = vi.fn()
    const unsubscribe = subscribeToAnnouncer(listener)

    announce("Picked up Shape block")

    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
  })

  test("stops notifying a listener once unsubscribed", () => {
    const listener = vi.fn()
    const unsubscribe = subscribeToAnnouncer(listener)

    unsubscribe()
    announce("Picked up Shape block")

    expect(listener).not.toHaveBeenCalled()
  })
})

describe("getAnnouncement", () => {
  test("appends an invisible suffix every other announcement so repeats still mutate the DOM", () => {
    announce("Selection cleared")

    const first = getAnnouncement()

    announce("Selection cleared")

    const second = getAnnouncement()

    expect(first).not.toBe(second)
    expect(second.startsWith("Selection cleared")).toBe(true)
  })
})

describe("shouldAnnounceGestureProgress", () => {
  test("allows the first call through", () => {
    vi.setSystemTime(new Date("2026-01-01T00:00:10Z"))

    expect(shouldAnnounceGestureProgress()).toBe(true)
  })

  test("throttles calls that arrive within the progress interval", () => {
    vi.setSystemTime(new Date("2026-01-01T00:00:20Z"))
    shouldAnnounceGestureProgress()
    vi.setSystemTime(new Date("2026-01-01T00:00:20.100Z"))

    expect(shouldAnnounceGestureProgress()).toBe(false)
  })

  test("allows another call once the interval has elapsed", () => {
    vi.setSystemTime(new Date("2026-01-01T00:00:30Z"))
    shouldAnnounceGestureProgress()
    vi.setSystemTime(new Date("2026-01-01T00:00:30.600Z"))

    expect(shouldAnnounceGestureProgress()).toBe(true)
  })
})

describe("resetGestureProgressThrottle", () => {
  test("lets a new gesture's first progress call through even inside the previous gesture's throttle window", () => {
    vi.setSystemTime(new Date("2026-01-01T00:00:40Z"))
    shouldAnnounceGestureProgress()
    vi.setSystemTime(new Date("2026-01-01T00:00:40.100Z"))
    resetGestureProgressThrottle()

    expect(shouldAnnounceGestureProgress()).toBe(true)
  })
})
