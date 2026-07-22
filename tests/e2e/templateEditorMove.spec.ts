import { expect, test } from "@playwright/test"

import { addOwnerSessionCookie } from "./support/ownerSession"
import { addRectangleBlock, createTemplateAndOpenEditor } from "./support/templateEditorFixture"

test.describe("template editor - block move", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    if (!baseURL) throw new Error("Playwright baseURL is required for owner session setup")

    await addOwnerSessionCookie(context, baseURL)
  })

  test("drop position matches the last dragged position with no revert frame", async ({ page }) => {
    await createTemplateAndOpenEditor(page, `E2E move ${Date.now()}`)
    await addRectangleBlock(page)

    const block = page.getByRole("button", { name: "Select Shape block" })
    const startBox = await block.boundingBox()

    if (!startBox) throw new Error("Shape block did not render a bounding box")

    const startX = startBox.x + startBox.width / 2
    const startY = startBox.y + startBox.height / 2
    const deltaX = 96
    const deltaY = 64

    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(startX + deltaX / 3, startY + deltaY / 3, { steps: 4 })
    await page.mouse.move(startX + (deltaX * 2) / 3, startY + (deltaY * 2) / 3, { steps: 4 })
    await page.mouse.move(startX + deltaX, startY + deltaY, { steps: 4 })
    await page.mouse.up()

    // Sample the very next animation frame after pointerup, before waiting for anything else to
    // settle: the engine must already paint the committed rect here, with no frame restoring the
    // pre-drag rectangle.
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    )

    const immediateBox = await block.boundingBox()

    // Generous settle window so any late revert or animation would surface as a difference
    // against the immediate sample.
    await page.waitForTimeout(300)

    const settledBox = await block.boundingBox()

    if (!immediateBox || !settledBox) {
      throw new Error("Shape block lost its bounding box after drop")
    }

    expect(Math.abs(settledBox.x - startBox.x)).toBeGreaterThan(1)
    expect(Math.abs(immediateBox.x - settledBox.x)).toBeLessThanOrEqual(1)
    expect(Math.abs(immediateBox.y - settledBox.y)).toBeLessThanOrEqual(1)

    // Exact landing: settled position must equal start position plus drag delta.
    expect(Math.abs(settledBox.x - (startBox.x + deltaX))).toBeLessThanOrEqual(1)
    expect(Math.abs(settledBox.y - (startBox.y + deltaY))).toBeLessThanOrEqual(1)
  })
})
