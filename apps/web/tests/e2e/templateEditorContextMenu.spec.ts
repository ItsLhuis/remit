import { expect, test } from "@playwright/test"

import { addOwnerSessionCookie } from "./support/ownerSession"
import {
  addRectangleBlock,
  createTemplateAndOpenEditor,
  openCanvasContextMenu
} from "./support/templateEditorFixture"

test.describe("template editor - canvas context menu", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    if (!baseURL) throw new Error("Playwright baseURL is required for owner session setup")

    await addOwnerSessionCookie(context, baseURL)
  })

  test("right-click opens the menu, copy then paste clones the block, and undo reverses it", async ({
    page
  }) => {
    await createTemplateAndOpenEditor(page, `E2E context menu ${Date.now()}`)
    await addRectangleBlock(page)

    const block = page.getByRole("button", { name: "Select Shape block" })

    await block.click()

    const sourceBox = await block.boundingBox()

    if (!sourceBox) throw new Error("Shape block did not render a bounding box")

    const menu = await openCanvasContextMenu(page, block)

    const copyItem = menu.getByRole("menuitem", { name: "Copy" }).filter({ hasNotText: "style" })

    await expect(copyItem).toBeEnabled()

    await copyItem.click()

    const pasteMenu = await openCanvasContextMenu(page, block)

    const pasteItem = pasteMenu
      .getByRole("menuitem", { name: "Paste" })
      .filter({ hasNotText: "here" })
      .filter({ hasNotText: "style" })

    await expect(pasteItem).toBeEnabled()

    await pasteItem.click()

    const blocks = page.getByRole("button", { name: "Select Shape block" })

    await expect(blocks).toHaveCount(2)

    const pastedBox = await blocks.nth(1).boundingBox()

    if (!pastedBox) throw new Error("Pasted block did not render a bounding box")

    // Plain paste offsets one grid cell (8px) from the copied source, clamped into the page bounds
    // (a no-op clamp here, since the source is well within bounds).
    expect(Math.abs(pastedBox.x - (sourceBox.x + 8))).toBeLessThanOrEqual(1)
    expect(Math.abs(pastedBox.y - (sourceBox.y + 8))).toBeLessThanOrEqual(1)

    await page.keyboard.press("ControlOrMeta+z")

    await expect(blocks).toHaveCount(1)
  })

  test("paste style transfers only the copied style, leaving the target's geometry untouched", async ({
    page
  }) => {
    await createTemplateAndOpenEditor(page, `E2E paste style ${Date.now()}`)
    await addRectangleBlock(page)
    await addRectangleBlock(page)

    const blocks = page.getByRole("button", { name: "Select Shape block" })

    await expect(blocks).toHaveCount(2)
    await blocks.nth(0).click()

    // Give the source block a solid background through the property panel, the same style-writing
    // path every other style edit uses.
    await page.getByRole("radio", { name: "Solid" }).click()

    const targetSolidToggle = page.getByRole("radio", { name: "Solid" })
    const targetBoxBefore = await blocks.nth(1).boundingBox()

    if (!targetBoxBefore) throw new Error("Target block did not render a bounding box")

    const copyStyleMenu = await openCanvasContextMenu(page, blocks.nth(0))

    await copyStyleMenu.getByRole("menuitem", { name: "Copy style" }).click()

    const pasteStyleMenu = await openCanvasContextMenu(page, blocks.nth(1))

    await pasteStyleMenu.getByRole("menuitem", { name: "Paste style" }).click()

    // The target now shows the pasted style in its own property panel...
    await blocks.nth(1).click()
    await expect(targetSolidToggle).toBeChecked()

    // ...while its position and size never moved.
    const targetBoxAfter = await blocks.nth(1).boundingBox()

    if (!targetBoxAfter) throw new Error("Target block lost its bounding box")

    expect(Math.abs(targetBoxAfter.x - targetBoxBefore.x)).toBeLessThanOrEqual(1)
    expect(Math.abs(targetBoxAfter.y - targetBoxBefore.y)).toBeLessThanOrEqual(1)
    expect(Math.abs(targetBoxAfter.width - targetBoxBefore.width)).toBeLessThanOrEqual(1)
    expect(Math.abs(targetBoxAfter.height - targetBoxBefore.height)).toBeLessThanOrEqual(1)

    await page.keyboard.press("ControlOrMeta+z")

    await expect(targetSolidToggle).not.toBeChecked()
  })
})
