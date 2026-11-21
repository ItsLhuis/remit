import { expect, test } from "@playwright/test"

import { E2E_OWNER_PASSWORD } from "./support/ownerCredentials"
import { generateTotpCode } from "./support/totp"

test.describe.configure({ mode: "serial" })

test.describe("canonical auth flow", () => {
  const ownerEmail = `owner-${Date.now()}@test.example`
  const ownerPassword = E2E_OWNER_PASSWORD

  test("registers, completes business setup and TOTP enrolment, and must save the recovery codes to finish", async ({
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
    await page.getByLabel("Password", { exact: true }).fill(ownerPassword)
    await page.getByLabel("Confirm password").fill(ownerPassword)
    await page.getByRole("button", { name: /create account/i }).click()

    await page.waitForURL("**/setup")
    await page.getByLabel(/business name/i).fill("Test Freelance Co")
    await page.getByLabel(/business email/i).fill("billing@test.example")
    await page.getByLabel(/country/i).click()
    await page.getByRole("option", { name: /united states$/i }).click()
    await page.getByLabel(/default currency/i).click()
    await page.getByRole("option", { name: /united states dollar/i }).click()
    await page.getByRole("button", { name: /continue/i }).click()

    await page.getByLabel("Password").fill(ownerPassword)
    await page.getByRole("button", { name: /set up authenticator/i }).click()

    await expect(page.getByRole("heading", { name: /scan qr code/i })).toBeVisible()

    // The manual-entry secret the page prints beside the QR code, which is what an authenticator
    // app is given when the QR cannot be scanned. It carries the base32 secret as its title.
    const secret = await page.getByTitle(/^[A-Z2-7]+=*$/).innerText()

    await page.getByLabel("Verification code").fill(generateTotpCode(secret))
    await page.getByRole("button", { name: "Verify code" }).click()

    await expect(page.getByRole("heading", { name: "Save your recovery codes" })).toBeVisible()

    const codeButtons = page.getByRole("button", { name: /^[A-Za-z0-9]{5}-[A-Za-z0-9]{5}/ })
    const count = await codeButtons.count()

    await expect(page.getByText(`${count} codes`, { exact: true })).toBeVisible()
    expect(count).toBeGreaterThan(0)

    const acknowledgement = page.getByRole("checkbox", {
      name: "I have saved my recovery codes in a safe place."
    })
    const continueButton = page.getByRole("button", { name: "Continue" })

    await expect(continueButton).toBeDisabled()

    await acknowledgement.check()

    await expect(continueButton).toBeEnabled()

    await continueButton.click()

    await expect(page.getByRole("heading", { name: "You're all set" })).toBeVisible()
  })

  test("login page shows CLI reset help when SMTP is not configured", async ({ page }) => {
    await page.goto("/login")

    test.skip(
      await page.getByRole("button", { name: /forgot password/i }).isVisible(),
      "The CLI reset help only renders on an instance with no email provider configured."
    )

    await expect(page.getByText(/remit:reset-password/i)).toBeVisible()
    await expect(page.getByRole("button", { name: /forgot password/i })).not.toBeVisible()
  })
})
