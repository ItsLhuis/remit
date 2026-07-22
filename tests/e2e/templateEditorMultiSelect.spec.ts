import { expect, test } from "@playwright/test"

import { addOwnerSessionCookie } from "./support/ownerSession"
import { addRectangleBlock, createTemplateAndOpenEditor } from "./support/templateEditorFixture"

test.describe("template editor - marquee and multi-move", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    if (!baseURL) throw new Error("Playwright baseURL is required for owner session setup")

    await addOwnerSessionCookie(context, baseURL)
  })

  test("a marquee selects both blocks and dragging one moves the set together", async ({
    page
  }) => {
    await createTemplateAndOpenEditor(page, `E2E marquee ${Date.now()}`)
    await addRectangleBlock(page)
    await addRectangleBlock(page)

    const blocks = page.getByRole("button", { name: "Select Shape block" })

    await expect(blocks).toHaveCount(2)

    const firstBox = await blocks.nth(0).boundingBox()
    const secondBox = await blocks.nth(1).boundingBox()

    if (!firstBox || !secondBox) throw new Error("Shape blocks did not render bounding boxes")

    // Marquee from an empty spot right of both blocks to above-left of the first, crossing both.
    const marqueeStartX = Math.max(firstBox.x, secondBox.x) + 400
    const marqueeStartY = secondBox.y + secondBox.height + 24

    await page.mouse.move(marqueeStartX, marqueeStartY)
    await page.mouse.down()
    await page.mouse.move(firstBox.x + 8, firstBox.y + 8, { steps: 6 })
    await page.mouse.up()

    await expect(blocks.nth(0)).toHaveAttribute("aria-pressed", "true")
    await expect(blocks.nth(1)).toHaveAttribute("aria-pressed", "true")

    const deltaX = 64
    const deltaY = 48

    await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(
      firstBox.x + firstBox.width / 2 + deltaX,
      firstBox.y + firstBox.height / 2 + deltaY,
      { steps: 6 }
    )
    await page.mouse.up()

    const movedFirst = await blocks.nth(0).boundingBox()
    const movedSecond = await blocks.nth(1).boundingBox()

    if (!movedFirst || !movedSecond) throw new Error("Shape blocks lost their bounding boxes")

    expect(Math.abs(movedFirst.x - (firstBox.x + deltaX))).toBeLessThanOrEqual(1)
    expect(Math.abs(movedFirst.y - (firstBox.y + deltaY))).toBeLessThanOrEqual(1)
    expect(Math.abs(movedSecond.x - (secondBox.x + deltaX))).toBeLessThanOrEqual(1)
    expect(Math.abs(movedSecond.y - (secondBox.y + deltaY))).toBeLessThanOrEqual(1)
  })
})
