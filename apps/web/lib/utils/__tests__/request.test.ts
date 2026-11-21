import { expect, test } from "vitest"

import { getIpAddress } from "../request"

test("returns the forwarded-for address when the header is present", () => {
  const headers = new Headers({ "x-forwarded-for": "203.0.113.7" })

  const result = getIpAddress(headers)

  expect(result).toBe("203.0.113.7")
})

test("returns the first hop when forwarded-for carries a proxy chain", () => {
  const headers = new Headers({ "x-forwarded-for": "203.0.113.7, 198.51.100.4, 192.0.2.1" })

  const result = getIpAddress(headers)

  expect(result).toBe("203.0.113.7")
})

test("trims surrounding whitespace from the forwarded-for address", () => {
  const headers = new Headers({ "x-forwarded-for": "  203.0.113.7  , 198.51.100.4" })

  const result = getIpAddress(headers)

  expect(result).toBe("203.0.113.7")
})

test("falls back to the real-ip address when forwarded-for is absent", () => {
  const headers = new Headers({ "x-real-ip": "198.51.100.4" })

  const result = getIpAddress(headers)

  expect(result).toBe("198.51.100.4")
})

test("falls back to the real-ip address when forwarded-for is present but empty", () => {
  const headers = new Headers({ "x-forwarded-for": "   ", "x-real-ip": "198.51.100.4" })

  const result = getIpAddress(headers)

  expect(result).toBe("198.51.100.4")
})

test("returns null when neither header carries an address", () => {
  const headers = new Headers({ "x-forwarded-for": "", "x-real-ip": "" })

  const result = getIpAddress(headers)

  expect(result).toBeNull()
})

test("returns null when no address headers are present at all", () => {
  const headers = new Headers()

  const result = getIpAddress(headers)

  expect(result).toBeNull()
})
