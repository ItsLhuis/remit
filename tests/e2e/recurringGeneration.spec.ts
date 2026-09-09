import { expect, test } from "@playwright/test"

import { isJobQueueReachable, startJobWorker } from "./support/jobWorker"
import { addOwnerSessionCookie } from "./support/ownerSession"
import { seedDueRecurringSchedule } from "./support/recurringScheduleFixture"

// Canonical flow 4 from .agents/rules/testing.md: a recurring schedule that has come due generates
// the expected draft, and a re-delivered occurrence generates nothing more. The queue, the worker,
// the registry and the job ids are all real; only the moment is moved, by dating the schedule in the
// past rather than by faking a clock BullMQ's own lock and delay arithmetic would also read.
test("generates one draft invoice for a due schedule and nothing more when the occurrence is re-delivered", async ({
  page,
  baseURL
}) => {
  if (!baseURL) throw new Error("Playwright baseURL is required for this flow")

  test.skip(
    !(await isJobQueueReachable()),
    "This flow drives a real queue and a real worker, so it needs Redis reachable from the test process."
  )

  const seeded = await seedDueRecurringSchedule()

  await addOwnerSessionCookie(page.context(), baseURL)

  await page.goto(`/recurring-invoices/${seeded.scheduleId}`)

  await expect(page.getByText("Nothing has been generated yet")).toBeVisible()

  // A structural locator because the summary card pairs its label and value as two siblings with no
  // accessible association, so `getByRole` cannot reach the value by its label. Reported as a
  // finding rather than worked around in the component.
  const nextRunValue = page.getByText("Next run").locator("xpath=following-sibling::span")
  const nextRunBefore = await nextRunValue.innerText()

  const generatedInvoiceLink = page.getByRole("link", { name: new RegExp(seeded.invoicePrefix) })

  const queue = await startJobWorker()

  try {
    const sweepJobId = `e2e.sweep.${seeded.scheduleId}`

    await queue.enqueueJob("recurring.schedule.sweep", {}, { jobId: sweepJobId })
    await queue.waitForJob(sweepJobId)

    await page.reload()

    await expect(page.getByText("1 invoice generated")).toBeVisible()
    await expect(generatedInvoiceLink).toBeVisible()
    // Separator-agnostic: the instance's locale decides whether 250000 cents reads 2,500.00 or
    // 2.500,00, and the magnitude is what this asserts.
    await expect(page.getByText(/2[.,\s]?500/)).toBeVisible()
    await expect(nextRunValue).not.toHaveText(nextRunBefore)

    await generatedInvoiceLink.click()
    await page.waitForURL(/\/invoices\/[^/]+$/)

    await expect(page.getByText("Draft", { exact: true }).first()).toBeVisible()
    await expect(page.getByText(seeded.projectName).first()).toBeVisible()
    await expect(page.getByText(seeded.lineDescription)).toBeVisible()

    // A fresh job id carrying the occurrence the sweep already generated, which is what a genuine
    // re-delivery looks like once BullMQ has freed the original: the deterministic id collapses a
    // repeat only while the first job still exists, so the guard exercised here is the transaction's
    // own re-read of `next_run_at`, not the id.
    const redeliveryJobId = `e2e.redelivery.${seeded.scheduleId}`

    await queue.enqueueJob(
      "recurring.invoice.generate",
      { recurringInvoiceId: seeded.scheduleId, occurrenceKey: seeded.occurrenceKey },
      { jobId: redeliveryJobId }
    )
    await queue.waitForJob(redeliveryJobId)

    await page.goto(`/recurring-invoices/${seeded.scheduleId}`)

    await expect(page.getByText("1 invoice generated")).toBeVisible()
    await expect(generatedInvoiceLink).toHaveCount(1)
  } finally {
    await queue.stop()
  }
})
