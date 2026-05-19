import { randomBytes } from "node:crypto"

import { createRequire } from "node:module"

import * as p from "@clack/prompts"

import { and, eq } from "drizzle-orm"

const require = createRequire(import.meta.url)

const { loadEnvConfig } = require("@next/env") as typeof import("@next/env")

loadEnvConfig(process.cwd())

function exitOnCancel<T>(value: T | symbol): T {
  if (p.isCancel(value)) {
    p.cancel("Password reset cancelled.")
    process.exit(0)
  }

  return value
}

async function main(): Promise<void> {
  p.intro("Remit password reset")

  // Operational recovery exception: this CLI repairs credential access when email reset is unavailable.
  const [{ database }, { accounts, auditLogs, users }, { auth }] = await Promise.all([
    import("@/database"),
    import("@/database/schema"),
    import("@/lib/auth")
  ])

  const emailInput = exitOnCancel(
    await p.text({
      message: "User email",
      placeholder: "name@example.com",
      validate(value) {
        const email = value?.trim()

        if (!email) {
          return "Email is required."
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return "Enter a valid email address."
        }

        return undefined
      }
    })
  )
  const email = emailInput.trim().toLowerCase()

  const lookup = p.spinner()
  lookup.start("Looking up user...")

  const user = await database.query.users.findFirst({
    where: eq(users.email, email),
    columns: { id: true, email: true, name: true, mustChangePassword: true, twoFactorEnabled: true }
  })

  if (!user) {
    lookup.stop("User not found.")
    p.cancel(`No user found with email: ${emailInput}`)
    process.exit(1)
  }

  lookup.stop("User found.")

  p.note(
    [
      `Email: ${user.email}`,
      `Name: ${user.name}`,
      `Must change password: ${user.mustChangePassword ? "yes" : "no"}`,
      `Two-factor authentication: ${user.twoFactorEnabled ? "enabled" : "disabled"}`
    ].join("\n"),
    "Account"
  )

  const confirmed = exitOnCancel(
    await p.confirm({
      message: "Reset this user's credential password?",
      initialValue: false
    })
  )

  if (!confirmed) {
    p.cancel("No changes were made.")
    process.exit(0)
  }

  const tempPassword = randomBytes(18).toString("base64url")

  const reset = p.spinner()
  reset.start("Resetting password...")

  try {
    const ctx = await auth.$context
    const hashedPassword = await ctx.password.hash(tempPassword)

    await database.transaction(async (transaction) => {
      const updatedAccounts = await transaction
        .update(accounts)
        .set({ password: hashedPassword })
        .where(and(eq(accounts.userId, user.id), eq(accounts.providerId, "credential")))
        .returning({ id: accounts.id })

      if (updatedAccounts.length === 0) {
        throw new Error(`No credential account found for user: ${user.email}`)
      }

      await transaction.update(users).set({ mustChangePassword: true }).where(eq(users.id, user.id))

      await transaction.insert(auditLogs).values({
        event: "auth.password_reset.cli_issued",
        actorUserId: null,
        actorRole: null,
        targetEntityType: "user",
        targetEntityId: user.id,
        metadata: {
          email: user.email,
          name: user.name,
          previousMustChangePassword: user.mustChangePassword
        },
        ipAddress: null,
        userAgent: "cli/reset-password"
      })
    })

    reset.stop("Password reset successful.")
  } catch (error) {
    reset.stop("Password reset failed.")
    throw error
  }

  p.note(
    [
      `User: ${user.email}`,
      `Temporary password: ${tempPassword}`,
      "",
      "The user must change this password on their next login."
    ].join("\n"),
    "Credentials"
  )

  if (!user.twoFactorEnabled) {
    p.note("This user does not currently have two-factor authentication enabled.", "Warning")
  }

  p.outro("Done.")
  process.exit(0)
}

main().catch((error: unknown) => {
  p.cancel("Password reset failed.")
  console.error(error)
  process.exit(1)
})
