import { describe, expect, test } from "vitest"

import { decryptString, encryptString } from "@/lib/encryption/aes"

const KEY = Buffer.alloc(32)

describe("encryptString / decryptString", () => {
  test("round-trips plaintext back to the original value", () => {
    const plaintext = "hello, world"

    const ciphertext = encryptString(plaintext, KEY)
    const result = decryptString(ciphertext, KEY)

    expect(result).toBe(plaintext)
  })

  test("produces a different ciphertext on each call due to random IV", () => {
    const plaintext = "same input"

    const first = encryptString(plaintext, KEY)
    const second = encryptString(plaintext, KEY)

    expect(first).not.toBe(second)
  })

  test("throws when ciphertext has been tampered with", () => {
    const ciphertext = encryptString("data", KEY)
    const [iv, ct, tag] = ciphertext.split(":")
    const tampered = `${iv}:${ct}ff:${tag}`

    expect(() => decryptString(tampered, KEY)).toThrow()
  })
})
