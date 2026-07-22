import { expect, test } from "@playwright/test"

import { addOwnerSessionCookie } from "./support/ownerSession"
import { addRectangleBlock, createTemplateAndOpenEditor } from "./support/templateEditorFixture"

test.describe("template editor - wheel zoom", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    if (!baseURL) throw new Error("Playwright baseURL is required for owner session setup")

    await addOwnerSessionCookie(context, baseURL)
  })

  test("Ctrl+wheel zooms while keeping the canvas point under the pointer fixed", async ({
    page
  }) => {
    await createTemplateAndOpenEditor(page, `E2E wheel zoom ${Date.now()}`)
    await addRectangleBlock(page)

    const block = page.getByRole("button", { name: "Select Shape block" })
    const startBox = await block.boundingBox()

    if (!startBox) throw new Error("Shape block did not render a bounding box")

    // A point away from the viewport's top-left origin: a zoom that (incorrectly) anchored at the
    // origin instead of the pointer would visibly drag this block away from the pointer, since its
    // distance from the origin scales with the zoom ratio.
    const pointerX = startBox.x + startBox.width / 2
    const pointerY = startBox.y + startBox.height / 2

    await page.mouse.move(pointerX, pointerY)
    await page.keyboard.down("Control")

    for (let tick = 0; tick < 6; tick += 1) {
      await page.mouse.wheel(0, -120)
      await page.waitForTimeout(30)
    }

    await page.keyboard.up("Control")

    const zoomedBox = await block.boundingBox()

    if (!zoomedBox) throw new Error("Shape block lost its bounding box after zoom")

    expect(zoomedBox.width).toBeGreaterThan(startBox.width)
    expect(pointerX).toBeGreaterThanOrEqual(zoomedBox.x)
    expect(pointerX).toBeLessThanOrEqual(zoomedBox.x + zoomedBox.width)
    expect(pointerY).toBeGreaterThanOrEqual(zoomedBox.y)
    expect(pointerY).toBeLessThanOrEqual(zoomedBox.y + zoomedBox.height)
  })
})
