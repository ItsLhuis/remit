import { expect, test } from "@playwright/test"

import { addOwnerSessionCookie } from "./support/ownerSession"
import { addTextBlock, createTemplateAndOpenEditor } from "./support/templateEditorFixture"

test.describe("template editor - inline merge variable autocomplete", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    if (!baseURL) throw new Error("Playwright baseURL is required for owner session setup")

    await addOwnerSessionCookie(context, baseURL)
  })

  test("typing {{ opens the autocomplete and Enter inserts the highlighted token", async ({
    page
  }) => {
    await createTemplateAndOpenEditor(page, `E2E merge variable autocomplete ${Date.now()}`)
    await addTextBlock(page)

    const block = page.getByRole("button", { name: "Select Text block" })

    await block.dblclick()

    const editable = page.getByRole("textbox", { name: "Text block content" })

    await expect(editable).toBeFocused()

    await page.keyboard.type("{{business")

    const suggestion = page.getByText("Business name")

    await expect(suggestion).toBeVisible()

    await page.keyboard.press("Enter")

    await expect(editable).toHaveText("{{business.name}}")
    await expect(suggestion).toBeHidden()

    // The block is still in edit mode - inserting a suggestion never committed or exited it.
    await expect(editable).toBeFocused()

    // Reopening the popover and pressing Escape closes only the popover, not the block: the
    // surface is still present and focused, and the just-inserted token is untouched.
    await page.keyboard.type(" {{cl")
    await expect(page.getByText("Client name")).toBeVisible()

    await page.keyboard.press("Escape")

    await expect(page.getByText("Client name")).toBeHidden()
    await expect(editable).toHaveText("{{business.name}} {{cl")
    await expect(editable).toBeFocused()

    // A second Escape, with the popover already closed, commits and exits the block as normal.
    await page.keyboard.press("Escape")

    await expect(page.getByRole("textbox", { name: "Text block content" })).toHaveCount(0)
  })

  test("clicking a suggestion inserts its token at the caret", async ({ page }) => {
    await createTemplateAndOpenEditor(page, `E2E merge variable click ${Date.now()}`)
    await addTextBlock(page)

    const block = page.getByRole("button", { name: "Select Text block" })

    await block.dblclick()

    const editable = page.getByRole("textbox", { name: "Text block content" })

    await page.keyboard.type("{{client.n")

    const suggestion = page.getByText("Client name")

    await expect(suggestion).toBeVisible()
    await suggestion.click()

    await expect(editable).toHaveText("{{client.name}}")
  })
})
