import { expect, test } from "@playwright/test"

test.describe.configure({ mode: "serial" })

test.describe("canonical auth flow", () => {
  const ownerEmail = `owner-${Date.now()}@test.example`
  const ownerPassword = "TestPassword123!"

  test("registers, completes business setup, and reaches the TOTP QR scan step", async ({
    page
  }) => {
    await page.goto("/register")

    test.skip(
      new URL(page.url()).pathname !== "/register",
      "Registration is only available before the instance has an owner user."
    )

    await expect(page.getByRole("heading", { name: /create your account/i })).toBeVisible()
    await page.getByLabel("Name").fill("Test Owner")
    await page.getByLabel("Email").fill(ownerEmail)
    await page.getByLabel("Password").fill(ownerPassword)
    await page.getByLabel("Confirm password").fill(ownerPassword)
    await page.getByRole("button", { name: /create account/i }).click()

    await page.waitForURL("**/setup")
    await page.getByLabel(/business name/i).fill("Test Freelance Co")
    await page.getByLabel(/business email/i).fill("billing@test.example")
    await page.getByLabel(/country/i).click()
    await page.getByRole("option", { name: /united states/i }).click()
    await page.getByLabel(/default currency/i).click()
    await page.getByRole("option", { name: /us dollar/i }).click()
    await page.getByRole("button", { name: /continue/i }).click()

    await page.getByLabel("Password").fill(ownerPassword)
    await page.getByRole("button", { name: /set up authenticator/i }).click()

    await expect(page.getByRole("heading", { name: /scan qr code/i })).toBeVisible()

    // Full TOTP verification is intentionally not covered here because Better Auth
    // does not expose a test bypass for completing TOTP verification.
  })

  test("login page shows CLI reset help when SMTP is not configured", async ({ page }) => {
    await page.goto("/login")

    await expect(page.getByText(/remit:reset-password/i)).toBeVisible()
    await expect(page.getByRole("button", { name: /forgot password/i })).not.toBeVisible()
  })
})
