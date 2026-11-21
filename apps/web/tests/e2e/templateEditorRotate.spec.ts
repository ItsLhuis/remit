import { expect, test } from "@playwright/test"

import { addOwnerSessionCookie } from "./support/ownerSession"
import { addRectangleBlock, createTemplateAndOpenEditor } from "./support/templateEditorFixture"

test.describe("template editor - block rotate", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    if (!baseURL) throw new Error("Playwright baseURL is required for owner session setup")

    await addOwnerSessionCookie(context, baseURL)
  })

  test("dragging a rotate zone with Shift commits a snapped rotation that persists", async ({
    page
  }) => {
    await createTemplateAndOpenEditor(page, `E2E rotate ${Date.now()}`)
    await addRectangleBlock(page)

    const block = page.getByRole("button", { name: "Select Shape block" })

    await block.click()

    const zone = page.locator('[data-rotate-zone="se"]')
    const blockBox = await block.boundingBox()
    const zoneBox = await zone.boundingBox()

    if (!blockBox || !zoneBox) throw new Error("Block or rotate zone did not render a bounding box")

    const centerX = blockBox.x + blockBox.width / 2
    const centerY = blockBox.y + blockBox.height / 2
    const startX = zoneBox.x + zoneBox.width / 2
    const startY = zoneBox.y + zoneBox.height / 2

    // The pointer orbits the selection center clockwise; Shift snaps the delta to 15° steps, so a
    // ~30° sweep commits exactly 30.
    const orbit = (degrees: number) => {
      const radians = (degrees * Math.PI) / 180
      const dx = startX - centerX
      const dy = startY - centerY

      return {
        x: centerX + dx * Math.cos(radians) - dy * Math.sin(radians),
        y: centerY + dx * Math.sin(radians) + dy * Math.cos(radians)
      }
    }

    await page.keyboard.down("Shift")
    await page.mouse.move(startX, startY)
    await page.mouse.down()

    for (const step of [10, 20, 29]) {
      const point = orbit(step)

      await page.mouse.move(point.x, point.y, { steps: 4 })
    }

    await page.mouse.up()
    await page.keyboard.up("Shift")

    // Sample the very next animation frame after pointerup: the commit render must already paint
    // the rotated block (no revert frame).
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    )

    const immediateTransform = await block.evaluate(
      (element) => getComputedStyle(element.parentElement as Element).transform
    )

    expect(immediateTransform).not.toBe("none")

    // Generous settle window so any late revert would surface against the immediate sample.
    await page.waitForTimeout(300)

    const settledTransform = await block.evaluate(
      (element) => getComputedStyle(element.parentElement as Element).transform
    )

    expect(settledTransform).toBe(immediateTransform)

    // The property panel's rotation field reads the committed document value.
    await expect(page.getByLabel("Rotation")).toHaveValue("30")
  })
})
