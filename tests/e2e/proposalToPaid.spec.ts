import { randomUUID } from "node:crypto"

import { expect, test, type Page } from "@playwright/test"

import { clearMailpitDelivery, configureMailpitDelivery } from "./support/emailDelivery"
import { clearMailbox, waitForLatestMailTo } from "./support/mailbox"
import { addOwnerSessionCookie } from "./support/ownerSession"
import { seedTaxRate } from "./support/taxRateFixture"

const suffix = randomUUID().slice(0, 8)

const CLIENT_NAME = `E2E proposal client ${suffix}`
const CLIENT_EMAIL = `e2e-proposal-${suffix}@example.test`
const PROJECT_NAME = `E2E proposal project ${suffix}`
const FIRST_LINE = `Design sprint ${suffix}`
const SECOND_LINE = `Discovery workshop ${suffix}`

// 2 x 500.00 taxed at 20% is 1200.00, and 400.00 less a quarter is 300.00. The two lines are shaped
// so neither feature touches the other's arithmetic: no rounding order can move the 1500.00 total,
// whatever the instance's locale renders it as.
const EXPECTED_TOTAL = /1[.,\s]?500/

let deliveryConfigured = false

async function fillLineItem(
  page: Page,
  position: number,
  values: { description: string; quantity: string; unitPrice: string }
): Promise<void> {
  const row = page.getByLabel(`Line item ${position}`)

  await row.getByLabel("Description").fill(values.description)
  await row.getByLabel("Qty").fill(values.quantity)
  await row.getByLabel("Unit price").fill(values.unitPrice)
}

// `next dev` compiles a route the first time a worker asks for it, and that compile lands inside the
// test body — the same reason `playwright.config.ts` raises the test timeout to 60s. Waiting on the
// page's own heading bounds it by the condition rather than by an action's default five seconds,
// which is what a plain `goto` followed by a click is really gambling on.
async function openRoute(page: Page, path: string, heading: string): Promise<void> {
  await page.goto(path)

  await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible({
    timeout: 30_000
  })
}

async function chooseOption(page: Page, trigger: string, option: string): Promise<void> {
  await page.getByLabel(trigger, { exact: true }).click()
  await page.getByRole("option", { name: option }).click()
}

test.beforeAll(async () => {
  deliveryConfigured = await configureMailpitDelivery()
})

test.afterAll(async () => {
  if (deliveryConfigured) await clearMailpitDelivery()
})

// Canonical flow 2 from .agents/rules/testing.md, and the longest chain in the product: client ->
// project -> proposal -> anonymous acceptance -> invoice -> paid. The acceptance half runs in its
// own browser context because that is the point of the flow — accepting while signed in as the
// owner would exercise none of the token or OTP path a client actually walks.
test("carries a proposal through anonymous acceptance into an invoice that is paid", async ({
  page,
  browser,
  baseURL
}) => {
  if (!baseURL) throw new Error("Playwright baseURL is required for this flow")

  test.skip(
    !deliveryConfigured,
    "The acceptance code is emailed, so this flow needs an instance with no email provider of its own to point at the mail sink."
  )

  const taxRate = await seedTaxRate()

  await addOwnerSessionCookie(page.context(), baseURL)

  await openRoute(page, "/clients", "Clients")
  await page.getByRole("button", { name: "Create client" }).first().click()

  const clientSheet = page.getByRole("dialog")

  await clientSheet.getByLabel("Name", { exact: true }).fill(CLIENT_NAME)
  await clientSheet.getByLabel("Email", { exact: true }).fill(CLIENT_EMAIL)
  await clientSheet.getByRole("button", { name: "Create client" }).click()

  await page.waitForURL(/\/clients\/[^/]+$/)

  await openRoute(page, "/projects", "Projects")
  await page.getByRole("button", { name: "Create project" }).first().click()

  const projectSheet = page.getByRole("dialog")

  await chooseOption(page, "Client", CLIENT_NAME)
  await projectSheet.getByLabel("Name", { exact: true }).fill(PROJECT_NAME)
  await projectSheet.getByRole("button", { name: "Create project" }).click()

  await page.waitForURL(/\/projects\/[^/]+$/)

  const projectId = new URL(page.url()).pathname.split("/")[2]

  await openRoute(page, "/proposals/new", "New proposal")

  await chooseOption(page, "Project", PROJECT_NAME)
  await chooseOption(page, "Client", CLIENT_NAME)

  await fillLineItem(page, 1, { description: FIRST_LINE, quantity: "2", unitPrice: "500" })
  await page.getByLabel("Line item 1").getByLabel("Tax").click()
  await page.getByRole("option", { name: taxRate.name }).click()

  await page.getByRole("button", { name: "Add line item" }).click()

  await fillLineItem(page, 2, { description: SECOND_LINE, quantity: "1", unitPrice: "400" })
  await page.getByLabel("Line item 2").getByLabel("Discount", { exact: true }).click()
  await page.getByRole("option", { name: "Percentage" }).click()
  await page.getByLabel("Line item 2").getByLabel("Discount percentage").fill("25")

  await page.getByRole("button", { name: "Create proposal" }).click()

  // Excludes `/proposals/new` explicitly: it satisfies a plain one-segment pattern, so a submit that
  // never left the form would resolve the wait and hand every later step a page it cannot drive.
  await page.waitForURL(/\/proposals\/(?!new$)[^/]+$/)

  await expect(page.getByText(EXPECTED_TOTAL).first()).toBeVisible()

  await clearMailbox()

  await page.getByRole("button", { name: "Send", exact: true }).click()
  await page.getByRole("button", { name: "Send proposal" }).click()

  const publicPath = await page.getByRole("textbox", { name: "Client link" }).inputValue()

  const clientContext = await browser.newContext()
  const clientPage = await clientContext.newPage()

  try {
    await clientPage.goto(publicPath)

    await clientPage.getByRole("button", { name: "Accept proposal" }).click()
    // Blurred deliberately: the identity form validates on blur and gates its submit on `isValid`,
    // so a filled-but-still-focused field leaves the button disabled. Reported as a finding.
    await clientPage.getByLabel("Email address").fill(CLIENT_EMAIL)
    await clientPage.getByLabel("Email address").blur()

    await clientPage.getByRole("button", { name: "Send code" }).click()

    const mail = await waitForLatestMailTo(CLIENT_EMAIL)
    // The code sits alone on its own line in the message body, so anchoring to the line keeps a
    // digit run elsewhere in the copy — a proposal number, a minute count — from being read as one.
    const code = /^\d{6}$/m.exec(mail.Text)?.[0]

    if (!code) throw new Error("The acceptance email carried no code")

    // Filled once, never retried: `/p/[token]/otp/request` allows five requests per address in a
    // quarter of an hour, and a spec that looped on a miss would be at the mercy of that window
    // rather than of the behaviour it is testing.
    await clientPage.getByLabel("Confirmation code").pressSequentially(code)
    await clientPage.getByRole("button", { name: "Confirm" }).click()

    // The same first-hit compile `openRoute` waits out, on a route handler rather than a page: the
    // verify POST is the first request `/p/[token]/otp/verify` has ever served, and that build lands
    // between the click and the outcome. The default five seconds is not enough for it.
    await expect(clientPage.getByText("Proposal accepted")).toBeVisible({ timeout: 30_000 })
  } finally {
    await clientContext.close()
  }

  await openRoute(page, `/projects/${projectId}/invoices`, "Invoices")

  await page.getByRole("button", { name: "More" }).click()
  await page.getByRole("menuitem", { name: "From accepted proposal" }).click()

  const convertDialog = page.getByRole("dialog")

  await convertDialog.getByLabel("Proposal").click()
  await page.getByRole("option", { name: EXPECTED_TOTAL }).click()
  await convertDialog.getByRole("button", { name: "Create invoice" }).click()

  await page.waitForURL(/\/invoices\/[^/]+$/)

  await expect(page.getByText(FIRST_LINE)).toBeVisible()
  await expect(page.getByText(SECOND_LINE)).toBeVisible()
  await expect(page.getByText(EXPECTED_TOTAL).first()).toBeVisible()

  await page.getByRole("button", { name: "Send", exact: true }).click()
  await page.getByRole("button", { name: "Send invoice" }).click()

  await page.getByRole("button", { name: "Record payment" }).click()

  const paymentSheet = page.getByRole("dialog")

  await paymentSheet.getByRole("button", { name: "Record payment" }).click()

  await expect(page.getByText("Paid", { exact: true }).first()).toBeVisible()
})
