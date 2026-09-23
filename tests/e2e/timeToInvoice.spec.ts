import { expect, test } from "@playwright/test"

import { seedBillableTimeEntry } from "./support/billableWorkFixture"
import { addOwnerSessionCookie } from "./support/ownerSession"
import { clickUntilVisible, openRoute } from "./support/pageReadiness"

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

  await openRoute(page, `/time?search=${encodeURIComponent(seeded.entryDescription)}`, "Time")

  const row = page.getByRole("row", { name: new RegExp(seeded.entryDescription) })

  await expect(row).toBeVisible()

  const sheet = page.getByRole("dialog")
  const billSelected = page.getByRole("button", { name: /Bill selected/ })

  // The checkbox is the first interaction after a full page load, so it is retried until the action
  // it unlocks is on screen: a click that lands before hydration is dropped rather than replayed.
  await clickUntilVisible(row.getByRole("checkbox"), billSelected)
  await clickUntilVisible(billSelected, sheet)

  await expect(sheet.getByText(seeded.entryDescription)).toBeVisible()

  await sheet.getByRole("button", { name: "Bill to invoice" }).click()

  await expect(sheet).toBeHidden()

  // The entry leaves the unbilled population the moment it is billed, which is the user-visible
  // proof that `invoiced_in_id` was stamped in the same transaction as the invoice.
  await expect(row.getByText("Invoiced")).toBeVisible()

  await openRoute(page, `/projects/${seeded.projectId}/invoices`, "Invoices")

  const invoiceLink = page.getByRole("link", { name: /INV-/ }).first()

  await expect(invoiceLink).toBeVisible()

  await invoiceLink.click()
  await page.waitForURL(/\/invoices\/[^/]+$/)

  await expect(page.getByText(seeded.entryDescription)).toBeVisible()

  const sendDialogButton = page.getByRole("button", { name: "Send invoice" })

  await clickUntilVisible(page.getByRole("button", { name: "Send", exact: true }), sendDialogButton)
  await sendDialogButton.click()

  const markPaid = page.getByRole("button", { name: "Mark as paid", exact: true })

  await expect(markPaid).toBeVisible()

  const markPaidConfirm = page.getByRole("dialog").getByRole("button", { name: "Mark as paid" })

  await clickUntilVisible(markPaid, markPaidConfirm)
  await markPaidConfirm.click()

  await expect(page.getByText("Paid", { exact: true }).first()).toBeVisible()
})
