import { expect, test } from "@playwright/test"

import { ensureOwnerTotpEnrolled } from "./support/ownerProvisioning"
import { addOwnerSessionCookie } from "./support/ownerSession"

test("the instance owner has finished setup and can reach the dashboard", async ({
  page,
  baseURL
}) => {
  if (!baseURL) throw new Error("Playwright baseURL is required for owner provisioning")

  await ensureOwnerTotpEnrolled()
  await addOwnerSessionCookie(page.context(), baseURL)

  await page.goto("/templates")

  // The assertion is the redirect, not the page content: an owner who is not fully enrolled is
  // sent to /setup by proxy.ts, and an unauthenticated one to /login, so staying on /templates is
  // exactly the precondition the editor specs depend on.
  await expect(page).toHaveURL(/\/templates$/)
  await expect(page.getByRole("heading", { name: "Templates" })).toBeVisible()
})
