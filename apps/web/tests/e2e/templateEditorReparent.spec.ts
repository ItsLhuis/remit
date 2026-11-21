import { expect, test } from "@playwright/test"

import { addOwnerSessionCookie } from "./support/ownerSession"
import {
  addFrameBlock,
  addRectangleBlock,
  createTemplateAndOpenEditor
} from "./support/templateEditorFixture"

test.describe("template editor - nested reparent", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    if (!baseURL) throw new Error("Playwright baseURL is required for owner session setup")

    await addOwnerSessionCookie(context, baseURL)
  })

  test("dragging a block into a frame nests it, and dragging back out frees it", async ({
    page
  }) => {
    await createTemplateAndOpenEditor(page, `E2E reparent ${Date.now()}`)
    await addFrameBlock(page)
    await addRectangleBlock(page)

    const frame = page.getByRole("button", { name: "Select Frame block" })
    const rectangle = page.getByRole("button", { name: "Select Shape block" })

    const frameBoxBefore = await frame.boundingBox()
    const rectangleBoxBefore = await rectangle.boundingBox()

    if (!frameBoxBefore || !rectangleBoxBefore) {
      throw new Error("Frame or shape block did not render a bounding box")
    }

    // Drop the rectangle comfortably inside the frame, clear of its top-left corner on both axes -
    // the reparent guard refuses any drop that would floor the child's local coordinate below zero.
    // Default insert sizes (NATURAL_WIDTHS/NATURAL_HEIGHTS): frame 480x120, shape 160x96.
    const targetX = frameBoxBefore.x + 120
    const targetY = frameBoxBefore.y + 60

    await page.mouse.move(
      rectangleBoxBefore.x + rectangleBoxBefore.width / 2,
      rectangleBoxBefore.y + rectangleBoxBefore.height / 2
    )
    await page.mouse.down()
    await page.mouse.move(
      rectangleBoxBefore.x + rectangleBoxBefore.width / 2 + (targetX - rectangleBoxBefore.x) / 2,
      rectangleBoxBefore.y + rectangleBoxBefore.height / 2 + (targetY - rectangleBoxBefore.y) / 2,
      { steps: 8 }
    )
    await page.mouse.move(targetX, targetY, { steps: 8 })
    await page.mouse.up()

    await expect(rectangle).toBeVisible()

    // Reparented: dragging the frame now carries the child with it (the coupling a visual overlap
    // alone would not prove).
    const frameBoxNested = await frame.boundingBox()
    const rectangleBoxNested = await rectangle.boundingBox()

    if (!frameBoxNested || !rectangleBoxNested) {
      throw new Error("Frame or nested shape block lost its bounding box")
    }

    // Click a part of the frame the centered child does not cover (its left margin) to select the
    // frame itself, per the layered selection model - a click always selects the top-level ancestor.
    const frameLeftMarginX = frameBoxNested.x + 10
    const frameCenterY = frameBoxNested.y + frameBoxNested.height / 2

    await page.mouse.click(frameLeftMarginX, frameCenterY)
    await expect(frame).toHaveAttribute("aria-pressed", "true")

    const frameDeltaX = 48
    const frameDeltaY = 32

    await page.mouse.move(frameLeftMarginX, frameCenterY)
    await page.mouse.down()
    await page.mouse.move(frameLeftMarginX + frameDeltaX, frameCenterY + frameDeltaY, { steps: 6 })
    await page.mouse.up()

    const rectangleBoxAfterFrameMove = await rectangle.boundingBox()

    if (!rectangleBoxAfterFrameMove) throw new Error("Nested shape block lost its bounding box")

    expect(
      Math.abs(rectangleBoxAfterFrameMove.x - (rectangleBoxNested.x + frameDeltaX))
    ).toBeLessThanOrEqual(1)
    expect(
      Math.abs(rectangleBoxAfterFrameMove.y - (rectangleBoxNested.y + frameDeltaY))
    ).toBeLessThanOrEqual(1)

    // Drag the child back out, purely horizontally to the right of the frame's own right edge -
    // clear of its drop-target hit area on the x-axis alone, and with no vertical displacement so
    // the page's auto-grown height (and the scroll/layout shift that follows) never moves during
    // the drag and invalidates the target computed before it started.
    const frameBoxAfterMove = await frame.boundingBox()

    if (!frameBoxAfterMove) throw new Error("Frame lost its bounding box")

    const escapeX = frameBoxAfterMove.x + frameBoxAfterMove.width + 60
    const escapeY = rectangleBoxAfterFrameMove.y + rectangleBoxAfterFrameMove.height / 2

    // A single click on nested content selects its top-level ancestor (the frame) per the layered
    // selection model; double-click descends one level to select the child itself, so the
    // subsequent drag moves only the shape.
    await rectangle.dblclick()

    await page.mouse.move(
      rectangleBoxAfterFrameMove.x + rectangleBoxAfterFrameMove.width / 2,
      rectangleBoxAfterFrameMove.y + rectangleBoxAfterFrameMove.height / 2
    )
    await page.mouse.down()
    await page.mouse.move(escapeX, escapeY, { steps: 8 })
    await page.mouse.up()

    const rectangleBoxFreed = await rectangle.boundingBox()

    if (!rectangleBoxFreed) throw new Error("Freed shape block lost its bounding box")

    // Freed: moving the frame again no longer carries the (no-longer-a-child) rectangle.
    const frameBoxFreed = await frame.boundingBox()

    if (!frameBoxFreed) throw new Error("Frame lost its bounding box")

    const freedFrameLeftMarginX = frameBoxFreed.x + 10
    const freedFrameCenterY = frameBoxFreed.y + frameBoxFreed.height / 2

    await page.mouse.move(freedFrameLeftMarginX, freedFrameCenterY)
    await page.mouse.down()
    await page.mouse.move(freedFrameLeftMarginX + 48, freedFrameCenterY + 32, { steps: 6 })
    await page.mouse.up()

    const rectangleBoxAfterSecondFrameMove = await rectangle.boundingBox()

    if (!rectangleBoxAfterSecondFrameMove)
      throw new Error("Freed shape block lost its bounding box")

    expect(Math.abs(rectangleBoxAfterSecondFrameMove.x - rectangleBoxFreed.x)).toBeLessThanOrEqual(
      1
    )
    expect(Math.abs(rectangleBoxAfterSecondFrameMove.y - rectangleBoxFreed.y)).toBeLessThanOrEqual(
      1
    )
  })
})
