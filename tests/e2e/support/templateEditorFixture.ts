import { expect, type Locator, type Page } from "@playwright/test"

// A real right-press has a duration; Playwright's default one does not, and on Linux that is the
// difference between a usable canvas context menu and an unusable one. Chromium raises
// `contextmenu` on mouse-down under X11 but on mouse-up on Windows, so on Linux the menu is already
// mounted when the button is released. `click({ button: "right" })` releases in the same task it
// presses, so that mouse-up reaches a menu Radix's popper has not positioned yet, lands on an item
// instead of on the content's padding, and Radix selects it - reopening the menu and immediately
// running an arbitrary action. Any non-zero press survives it (measured: 0ms selects, 16ms does
// not), so this is the press duration a human cannot go below, not a wait for the app to settle.
const RIGHT_PRESS_MS = 120

export async function createTemplateAndOpenEditor(page: Page, name: string): Promise<void> {
  await page.goto("/templates")

  // TemplatesListPage renders the same "Create template" action twice: once in the page <header>
  // and once inside the DataTable's empty state, which the table cell holds while the instance has
  // no templates. Scoping to the header keeps this unambiguous whether the table is empty or not.
  const createButton = page.locator("header").getByRole("button", { name: "Create template" })

  const dialog = page.getByRole("dialog")

  // The button is in the server-rendered HTML long before /templates hydrates, and this route
  // hydrates slowly - it ships the data table, the summary charts and the command palette. A click
  // that lands first is not lost (React replays it), but it only opens the sheet once hydration
  // finishes, which on a loaded CI runner is seconds later and burns the whole test budget waiting
  // in `fill`. Retrying the click until the sheet is actually up bounds that wait by the condition
  // instead of by the test timeout. `setCreateOpen(true)` is idempotent, so a replayed first click
  // plus a retry cannot toggle the sheet back shut.
  await expect(async () => {
    await createButton.click()
    await expect(dialog).toBeVisible({ timeout: 1000 })
  }).toPass({ timeout: 20_000 })

  await dialog.getByLabel("Name").fill(name)
  await dialog.getByRole("button", { name: "Create template" }).click()

  await page.waitForURL(/\/templates\/[^/]+$/)
}

// Returns the open menu so callers scope their item lookups to it: Radix keeps a dismissed menu
// mounted for its exit animation, and a page-scoped `getByRole("menuitem")` latches that stale copy
// - every item of the previous menu is still in the DOM, disabled state and all - only for it to
// detach mid-action.
export async function openCanvasContextMenu(page: Page, target: Locator): Promise<Locator> {
  await target.click({ button: "right", delay: RIGHT_PRESS_MS })

  const menu = page.getByRole("menu")

  await expect(menu).toBeVisible()

  return menu
}

export async function addRectangleBlock(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Insert block" }).click()
  await page.getByRole("menuitem", { name: "Rectangle" }).click()
}

export async function addTextBlock(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Insert block" }).click()
  await page.getByRole("menuitem", { name: "Text" }).click()
}

export async function addFrameBlock(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Insert block" }).click()
  await page.getByRole("menuitem", { name: "Frame" }).click()
}
