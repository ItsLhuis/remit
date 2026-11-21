// @vitest-environment happy-dom

import { act, cleanup, renderHook } from "@testing-library/react"

import { afterEach, beforeEach, expect, test, vi, type MockedFunction } from "vitest"

import { useCopyWithFeedback } from "../useCopyWithFeedback"

let clipboardWriteText: MockedFunction<Clipboard["writeText"]>
let originalClipboardDescriptor: PropertyDescriptor | undefined

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-05-30T12:00:00.000Z"))

  originalClipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard")
  clipboardWriteText = vi.fn<Clipboard["writeText"]>()

  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: clipboardWriteText
    } satisfies Pick<Clipboard, "writeText">
  })
})

afterEach(() => {
  cleanup()

  if (originalClipboardDescriptor) {
    Object.defineProperty(navigator, "clipboard", originalClipboardDescriptor)
  } else {
    Reflect.deleteProperty(navigator, "clipboard")
  }

  vi.useRealTimers()
})

test("shows copied feedback when the clipboard write succeeds", async () => {
  clipboardWriteText.mockResolvedValueOnce()

  const { result } = renderHook(() => useCopyWithFeedback())

  await act(async () => {
    await result.current.copy("https://remit.test/invoices/public-token")
  })

  expect(result.current.copied).toBe(true)
})

test("clears copied feedback when the feedback timeout elapses", async () => {
  clipboardWriteText.mockResolvedValueOnce()

  const { result } = renderHook(() => useCopyWithFeedback(1_000))

  await act(async () => {
    await result.current.copy("https://remit.test/proposals/public-token")
  })

  act(() => {
    vi.advanceTimersByTime(999)
  })

  expect(result.current.copied).toBe(true)

  act(() => {
    vi.advanceTimersByTime(1)
  })

  expect(result.current.copied).toBe(false)
})

test("leaves feedback hidden when the clipboard write is rejected", async () => {
  clipboardWriteText.mockRejectedValueOnce(new Error("clipboard denied"))

  const { result } = renderHook(() => useCopyWithFeedback())

  await act(async () => {
    await result.current.copy("secret text")
  })

  expect(result.current.copied).toBe(false)
})
