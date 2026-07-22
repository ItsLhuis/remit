import { expect, test } from "@playwright/test"

import { addOwnerSessionCookie } from "./support/ownerSession"
import { addRectangleBlock, createTemplateAndOpenEditor } from "./support/templateEditorFixture"

test.describe("template editor - block resize", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    if (!baseURL) throw new Error("Playwright baseURL is required for owner session setup")

    await addOwnerSessionCookie(context, baseURL)
  })

  test("dragging the south-east handle changes the committed width and height", async ({
    page
  }) => {
    await createTemplateAndOpenEditor(page, `E2E resize ${Date.now()}`)
    await addRectangleBlock(page)

    const block = page.getByRole("button", { name: "Select Shape block" })

    await block.click()

    // Handles carry their direction in the accessible name; south-east grows both axes without
    // moving the block's origin.
    const handle = page.getByRole("button", { name: "Resize block (se)" })

    const startBlockBox = await block.boundingBox()
    const startHandleBox = await handle.boundingBox()

    if (!startBlockBox || !startHandleBox) {
      throw new Error("Block or resize handle did not render a bounding box")
    }

    const handleX = startHandleBox.x + startHandleBox.width / 2
    const handleY = startHandleBox.y + startHandleBox.height / 2
    const deltaX = 64
    const deltaY = 48

    await page.mouse.move(handleX, handleY)
    await page.mouse.down()
    await page.mouse.move(handleX + deltaX / 3, handleY + deltaY / 3, { steps: 4 })
    await page.mouse.move(handleX + (deltaX * 2) / 3, handleY + (deltaY * 2) / 3, { steps: 4 })
    await page.mouse.move(handleX + deltaX, handleY + deltaY, { steps: 4 })
    await page.mouse.up()

    // Sample the very next animation frame after pointerup, before waiting for anything else to
    // settle: the commit render must already paint the resized rect (no revert frame).
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    )

    const immediateBox = await block.boundingBox()

    // Generous settle window, so any late revert or animation would surface as a difference
    // against the immediate sample.
    await page.waitForTimeout(300)

    const settledBox = await block.boundingBox()

    if (!immediateBox || !settledBox) {
      throw new Error("Shape block lost its bounding box after resize")
    }

    expect(Math.abs(immediateBox.width - settledBox.width)).toBeLessThanOrEqual(1)
    expect(Math.abs(immediateBox.height - settledBox.height)).toBeLessThanOrEqual(1)

    // Exact landing: the deltas are grid multiples, so the committed size is start plus delta,
    // and the anchored north-west origin has not moved.
    expect(Math.abs(settledBox.width - (startBlockBox.width + deltaX))).toBeLessThanOrEqual(1)
    expect(Math.abs(settledBox.height - (startBlockBox.height + deltaY))).toBeLessThanOrEqual(1)
    expect(Math.abs(settledBox.x - startBlockBox.x)).toBeLessThanOrEqual(1)
    expect(Math.abs(settledBox.y - startBlockBox.y)).toBeLessThanOrEqual(1)
  })

  test("dragging the west handle keeps the east edge anchored", async ({ page }) => {
    await createTemplateAndOpenEditor(page, `E2E resize west ${Date.now()}`)
    await addRectangleBlock(page)

    const block = page.getByRole("button", { name: "Select Shape block" })

    // A block at the content origin has its west handle clipped outside the horizontally
    // overflowing canvas scroll area, so drag the block right first to make the handle reachable.
    const spawnBox = await block.boundingBox()

    if (!spawnBox) throw new Error("Shape block did not render a bounding box")

    const spawnX = spawnBox.x + spawnBox.width / 2
    const spawnY = spawnBox.y + spawnBox.height / 2

    await page.mouse.move(spawnX, spawnY)
    await page.mouse.down()
    await page.mouse.move(spawnX + 80, spawnY + 32, { steps: 4 })
    await page.mouse.move(spawnX + 160, spawnY + 64, { steps: 4 })
    await page.mouse.up()

    await page.waitForTimeout(300)

    const handle = page.getByRole("button", { name: "Resize block (w)" })

    const startBlockBox = await block.boundingBox()
    const startHandleBox = await handle.boundingBox()

    if (!startBlockBox || !startHandleBox) {
      throw new Error("Block or resize handle did not render a bounding box")
    }

    const handleX = startHandleBox.x + startHandleBox.width / 2
    const handleY = startHandleBox.y + startHandleBox.height / 2
    const deltaX = 40

    await page.mouse.move(handleX, handleY)
    await page.mouse.down()
    await page.mouse.move(handleX + deltaX / 2, handleY, { steps: 4 })
    await page.mouse.move(handleX + deltaX, handleY, { steps: 4 })
    await page.mouse.up()

    await page.waitForTimeout(300)

    const settledBox = await block.boundingBox()

    if (!settledBox) throw new Error("Shape block lost its bounding box after resize")

    const startRight = startBlockBox.x + startBlockBox.width
    const settledRight = settledBox.x + settledBox.width

    expect(Math.abs(settledBox.width - (startBlockBox.width - deltaX))).toBeLessThanOrEqual(1)
    expect(Math.abs(settledRight - startRight)).toBeLessThanOrEqual(1)
  })
})
