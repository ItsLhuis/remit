import { describe, expect, test } from "vitest"

import { decryptValue, encryptValue } from "../values"
import { keysEqual, validateKey } from "../keyValidation"

describe("encryption helpers", () => {
  test("validates base64 keys that decode to 32 bytes", () => {
    const rawKey = Buffer.alloc(32, 1).toString("base64")

    const result = validateKey(rawKey)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.key).toEqual(Buffer.alloc(32, 1))
    }
  })

  test("rejects missing, malformed, and wrong-length keys", () => {
    expect(validateKey("").ok).toBe(false)
    expect(validateKey("not-base64").ok).toBe(false)
    expect(validateKey(Buffer.alloc(31, 1).toString("base64")).ok).toBe(false)
  })

  test("round-trips values with distinct old and new keys", () => {
    const oldKey = Buffer.alloc(32, 2)
    const newKey = Buffer.alloc(32, 3)
    const plaintext = "Sensitive operational value"

    const oldEncrypted = encryptValue(plaintext, oldKey)
    const decrypted = decryptValue(oldEncrypted, oldKey)
    const newEncrypted = encryptValue(decrypted, newKey)

    expect(decryptValue(newEncrypted, newKey)).toBe(plaintext)
    expect(() => decryptValue(oldEncrypted, newKey)).toThrow()
  })

  test("compares key bytes without accepting length mismatches", () => {
    expect(keysEqual(Buffer.alloc(32, 4), Buffer.alloc(32, 4))).toBe(true)
    expect(keysEqual(Buffer.alloc(32, 4), Buffer.alloc(32, 5))).toBe(false)
    expect(keysEqual(Buffer.alloc(32, 4), Buffer.alloc(31, 4))).toBe(false)
  })
})
