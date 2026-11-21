import { expect, type Locator, type Page } from "@playwright/test"

const ROUTE_READY_TIMEOUT_MS = 30_000
const HYDRATION_TIMEOUT_MS = 30_000
const CLICK_TIMEOUT_MS = 2_000
const OUTCOME_TIMEOUT_MS = 1_000

// A navigation is bounded by the page's own heading rather than by the next action's default five
// seconds, which is what a plain `goto` followed by a click is really gambling on: a server-rendered
// list page queries before it paints, and a loaded runner shared with the app's own containers can
// take longer than that to answer.
export async function openRoute(page: Page, path: string, heading: string): Promise<void> {
  await page.goto(path)

  await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible({
    timeout: ROUTE_READY_TIMEOUT_MS
  })
}

// A server-rendered page shows its heading before React has hydrated it, and a click in that window
// reaches no handler: it is dropped, not replayed, so the sheet or menu it should open never
// appears. On a loaded CI runner that window is wide enough to swallow the first click after a full
// page load. Retrying until the click's outcome is on screen waits hydration out by the very thing
// the next step needs. The outcome is checked before every click so a retry never toggles an
// already-open menu shut, and the short click timeout stops a click that the now-open overlay
// intercepts from outliving the retry.
export async function clickUntilVisible(trigger: Locator, outcome: Locator): Promise<void> {
  await expect(async () => {
    if (!(await outcome.isVisible())) await trigger.click({ timeout: CLICK_TIMEOUT_MS })

    await expect(outcome).toBeVisible({ timeout: OUTCOME_TIMEOUT_MS })
  }).toPass({ timeout: HYDRATION_TIMEOUT_MS })
}
