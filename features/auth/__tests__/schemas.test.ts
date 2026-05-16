import { describe, expect, test } from "vitest"

import {
  accountSchema,
  changePasswordSchema,
  recoveryCodeSchema,
  resetPasswordSchema
} from "../schemas"

const VALID_PASSWORD = "ValidPassword1!"

describe("changePasswordSchema", () => {
  test("accepts valid passwords with matching confirmation", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "anything",
      newPassword: VALID_PASSWORD,
      confirmPassword: VALID_PASSWORD
    })

    expect(result.success).toBe(true)
  })

  test("rejects a new password shorter than 12 characters", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "anything",
      newPassword: "Short1!",
      confirmPassword: "Short1!"
    })

    expect(result.success).toBe(false)
  })

  test("rejects a new password without an uppercase letter", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "anything",
      newPassword: "nouppercase1!",
      confirmPassword: "nouppercase1!"
    })

    expect(result.success).toBe(false)
  })

  test("rejects a new password without a lowercase letter", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "anything",
      newPassword: "NOLOWERCASE1!",
      confirmPassword: "NOLOWERCASE1!"
    })

    expect(result.success).toBe(false)
  })

  test("rejects a new password without a number", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "anything",
      newPassword: "NoNumber!!!!!!",
      confirmPassword: "NoNumber!!!!!!"
    })

    expect(result.success).toBe(false)
  })

  test("rejects a new password without a special character", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "anything",
      newPassword: "NoSpecial12345",
      confirmPassword: "NoSpecial12345"
    })

    expect(result.success).toBe(false)
  })

  test("rejects when new password and confirmation do not match", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "anything",
      newPassword: VALID_PASSWORD,
      confirmPassword: "DifferentPassword1!"
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0].path).toContain("confirmPassword")
  })
})

describe("resetPasswordSchema", () => {
  test("accepts matching passwords that satisfy complexity rules", () => {
    const result = resetPasswordSchema.safeParse({
      newPassword: VALID_PASSWORD,
      confirmPassword: VALID_PASSWORD
    })

    expect(result.success).toBe(true)
  })

  test("rejects when passwords do not match", () => {
    const result = resetPasswordSchema.safeParse({
      newPassword: VALID_PASSWORD,
      confirmPassword: "DifferentPassword1!"
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0].path).toContain("confirmPassword")
  })
})

describe("accountSchema", () => {
  test("accepts a valid registration payload", () => {
    const result = accountSchema.safeParse({
      name: "Alice Test",
      email: "alice@example.com",
      password: VALID_PASSWORD,
      confirmPassword: VALID_PASSWORD
    })

    expect(result.success).toBe(true)
  })

  test("rejects when name is empty", () => {
    const result = accountSchema.safeParse({
      name: "",
      email: "alice@example.com",
      password: VALID_PASSWORD,
      confirmPassword: VALID_PASSWORD
    })

    expect(result.success).toBe(false)
  })

  test("rejects an invalid email address", () => {
    const result = accountSchema.safeParse({
      name: "Alice Test",
      email: "not-an-email",
      password: VALID_PASSWORD,
      confirmPassword: VALID_PASSWORD
    })

    expect(result.success).toBe(false)
  })

  test("rejects a password that does not meet complexity requirements", () => {
    const result = accountSchema.safeParse({
      name: "Alice Test",
      email: "alice@example.com",
      password: "weakpassword",
      confirmPassword: "weakpassword"
    })

    expect(result.success).toBe(false)
  })

  test("rejects when password and confirmation do not match", () => {
    const result = accountSchema.safeParse({
      name: "Alice Test",
      email: "alice@example.com",
      password: VALID_PASSWORD,
      confirmPassword: "DifferentPassword1!"
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0].path).toContain("confirmPassword")
  })
})

describe("recoveryCodeSchema", () => {
  test("accepts a valid alphanumeric recovery code", () => {
    const result = recoveryCodeSchema.safeParse({ code: "ABC12345" })

    expect(result.success).toBe(true)
  })

  test("accepts a recovery code containing dashes", () => {
    const result = recoveryCodeSchema.safeParse({ code: "ABCD-1234" })

    expect(result.success).toBe(true)
  })

  test("rejects a code shorter than 8 characters", () => {
    const result = recoveryCodeSchema.safeParse({ code: "ABC123" })

    expect(result.success).toBe(false)
  })

  test("rejects a code containing spaces or symbols", () => {
    const result = recoveryCodeSchema.safeParse({ code: "invalid code!" })

    expect(result.success).toBe(false)
  })
})
