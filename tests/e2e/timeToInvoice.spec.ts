import { expect, test } from "@playwright/test"

import { seedBillableTimeEntry } from "./support/billableWorkFixture"
import { addOwnerSessionCookie } from "./support/ownerSession"

// Canonical flow 3 from .agents/rules/testing.md: time entry -> conversion to invoice -> send ->
// mark paid. It had no spec because no application path converted unbilled time, which is the gap
// this flow now closes end to end.
test("bills a time entry onto an invoice, sends it, and marks it paid", async ({
  page,
  baseURL
}) => {
  if (!baseURL) throw new Error("Playwright baseURL is required for this flow")

  const seeded = await seedBillableTimeEntry()

  await addOwnerSessionCookie(page.context(), baseURL)

  await page.goto(`/time?search=${encodeURIComponent(seeded.entryDescription)}`)

  const row = page.getByRole("row", { name: new RegExp(seeded.entryDescription) })

  await expect(row).toBeVisible()

  await row.getByRole("checkbox").check()

  await page.getByRole("button", { name: /Bill selected/ }).click()

  const sheet = page.getByRole("dialog")

  await expect(sheet).toBeVisible()
  await expect(sheet.getByText(seeded.entryDescription)).toBeVisible()

  await sheet.getByRole("button", { name: "Bill to invoice" }).click()

  await expect(sheet).toBeHidden()

  // The entry leaves the unbilled population the moment it is billed, which is the user-visible
  // proof that `invoiced_in_id` was stamped in the same transaction as the invoice.
  await expect(row.getByText("Invoiced")).toBeVisible()

  await page.goto(`/projects/${seeded.projectId}/invoices`)

  const invoiceLink = page.getByRole("link", { name: /INV-/ }).first()

  await expect(invoiceLink).toBeVisible()

  await invoiceLink.click()
  await page.waitForURL(/\/invoices\/[^/]+$/)

  await expect(page.getByText(seeded.entryDescription)).toBeVisible()

  await page.getByRole("button", { name: "Send", exact: true }).click()
  await page.getByRole("button", { name: "Send invoice" }).click()

  await expect(page.getByRole("button", { name: "Mark as paid", exact: true })).toBeVisible()

  await page.getByRole("button", { name: "Mark as paid", exact: true }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Mark as paid" }).click()

  await expect(page.getByText("Paid", { exact: true }).first()).toBeVisible()
})
