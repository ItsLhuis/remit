import { expect, test, type Page } from "@playwright/test"

import { addOwnerSessionCookie } from "./support/ownerSession"
import { addTextBlock, createTemplateAndOpenEditor } from "./support/templateEditorFixture"

// Rounds away the sub-pixel drift a fractional zoom (0.5x, 2x) introduces between the block
// wrapper's pre-edit box and the inline editor surface it replaces at the exact same place.
const POSITION_TOLERANCE = 2

async function setZoom(page: Page, level: "50%" | "200%"): Promise<void> {
  await page.keyboard.press("ControlOrMeta+0")

  const steps =
    level === "50%"
      ? ["ControlOrMeta+Minus", "ControlOrMeta+Minus"]
      : ["ControlOrMeta+Equal", "ControlOrMeta+Equal", "ControlOrMeta+Equal"]

  for (const step of steps) await page.keyboard.press(step)
}

test.describe("template editor - inline text edit position at non-default zoom", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    if (!baseURL) throw new Error("Playwright baseURL is required for owner session setup")

    await addOwnerSessionCookie(context, baseURL)
  })

  for (const level of ["50%", "200%"] as const) {
    test(`entering, editing, and committing inline text stays at the block's exact position at ${level} zoom`, async ({
      page
    }) => {
      await createTemplateAndOpenEditor(page, `E2E text edit zoom ${level} ${Date.now()}`)
      await addTextBlock(page)
      await setZoom(page, level)

      const block = page.getByRole("button", { name: "Select Text block" })
      const beforeBox = await block.boundingBox()

      if (!beforeBox) throw new Error("Text block did not render a bounding box")

      await block.dblclick()

      const editable = page.getByRole("textbox", { name: "Text block content" })

      await expect(editable).toBeFocused()

      const editingBox = await editable.boundingBox()

      if (!editingBox) throw new Error("Inline editor surface did not render a bounding box")

      expect(Math.abs(editingBox.x - beforeBox.x)).toBeLessThanOrEqual(POSITION_TOLERANCE)
      expect(Math.abs(editingBox.y - beforeBox.y)).toBeLessThanOrEqual(POSITION_TOLERANCE)
      expect(Math.abs(editingBox.width - beforeBox.width)).toBeLessThanOrEqual(POSITION_TOLERANCE)
      expect(Math.abs(editingBox.height - beforeBox.height)).toBeLessThanOrEqual(POSITION_TOLERANCE)

      await page.keyboard.type("Hello")
      await page.keyboard.press("Escape")

      await expect(page.getByRole("textbox", { name: "Text block content" })).toHaveCount(0)

      const afterBox = await block.boundingBox()

      if (!afterBox) throw new Error("Text block lost its bounding box after committing")

      expect(Math.abs(afterBox.x - beforeBox.x)).toBeLessThanOrEqual(POSITION_TOLERANCE)
      expect(Math.abs(afterBox.y - beforeBox.y)).toBeLessThanOrEqual(POSITION_TOLERANCE)
    })
  }
})
