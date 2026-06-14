// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, test } from "vitest"

import { act, cleanup, renderHook } from "@testing-library/react"

import { useLocalStorage } from "../useLocalStorage"

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

describe("useLocalStorage", () => {
  test("returns the default value when nothing is stored", () => {
    const { result } = renderHook(() => useLocalStorage("missing", { a: true }))

    expect(result.current[0]).toEqual({ a: true })
  })

  test("reads the persisted value after mount", () => {
    window.localStorage.setItem("visibility", JSON.stringify({ email: false }))

    const { result } = renderHook(() => useLocalStorage("visibility", {}))

    expect(result.current[0]).toEqual({ email: false })
  })

  test("persists the value to localStorage when set", () => {
    const { result } = renderHook(() => useLocalStorage<Record<string, boolean>>("visibility", {}))

    act(() => result.current[1]({ email: false }))

    expect(result.current[0]).toEqual({ email: false })
    expect(JSON.parse(window.localStorage.getItem("visibility") ?? "null")).toEqual({
      email: false
    })
  })

  test("supports a functional updater", () => {
    const { result } = renderHook(() =>
      useLocalStorage<Record<string, boolean>>("visibility", { name: true })
    )

    act(() => result.current[1]((current) => ({ ...current, email: false })))

    expect(result.current[0]).toEqual({ name: true, email: false })
    expect(JSON.parse(window.localStorage.getItem("visibility") ?? "null")).toEqual({
      name: true,
      email: false
    })
  })

  test("does not touch localStorage when the key is null", () => {
    const { result } = renderHook(() => useLocalStorage<Record<string, boolean>>(null, {}))

    act(() => result.current[1]({ email: false }))

    expect(result.current[0]).toEqual({ email: false })
    expect(window.localStorage.length).toBe(0)
  })

  test("falls back to the default value when stored data is malformed", () => {
    window.localStorage.setItem("visibility", "{not valid json")

    const { result } = renderHook(() => useLocalStorage("visibility", { a: 1 }))

    expect(result.current[0]).toEqual({ a: 1 })
  })
})
