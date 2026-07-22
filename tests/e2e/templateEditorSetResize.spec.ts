import { expect, test } from "@playwright/test"

import { addOwnerSessionCookie } from "./support/ownerSession"
import { addRectangleBlock, createTemplateAndOpenEditor } from "./support/templateEditorFixture"

test.describe("template editor - group and multi-selection resize", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    if (!baseURL) throw new Error("Playwright baseURL is required for owner session setup")

    await addOwnerSessionCookie(context, baseURL)
  })

  test("resizing a multi-selection's shared handle scales every member by the same ratio", async ({
    page
  }) => {
    await createTemplateAndOpenEditor(page, `E2E set resize multi ${Date.now()}`)
    await addRectangleBlock(page)
    await addRectangleBlock(page)

    const blocks = page.getByRole("button", { name: "Select Shape block" })

    await expect(blocks).toHaveCount(2)

    const firstBox = await blocks.nth(0).boundingBox()
    const secondBox = await blocks.nth(1).boundingBox()

    if (!firstBox || !secondBox) throw new Error("Shape blocks did not render bounding boxes")

    const marqueeStartX = Math.max(firstBox.x, secondBox.x) + 400
    const marqueeStartY = secondBox.y + secondBox.height + 24

    await page.mouse.move(marqueeStartX, marqueeStartY)
    await page.mouse.down()
    await page.mouse.move(firstBox.x + 8, firstBox.y + 8, { steps: 6 })
    await page.mouse.up()

    await expect(blocks.nth(0)).toHaveAttribute("aria-pressed", "true")
    await expect(blocks.nth(1)).toHaveAttribute("aria-pressed", "true")

    // The shared bounding box's own se handle - the same handle a single selection would show.
    const handle = page.getByRole("button", { name: "Resize block (se)" })
    const handleBox = await handle.boundingBox()

    if (!handleBox) throw new Error("Resize handle did not render a bounding box")

    const handleX = handleBox.x + handleBox.width / 2
    const handleY = handleBox.y + handleBox.height / 2

    await page.mouse.move(handleX, handleY)
    await page.mouse.down()
    await page.mouse.move(handleX + 80, handleY + 64, { steps: 6 })
    await page.mouse.up()

    const resizedFirst = await blocks.nth(0).boundingBox()
    const resizedSecond = await blocks.nth(1).boundingBox()

    if (!resizedFirst || !resizedSecond) throw new Error("Shape blocks lost their bounding boxes")

    // Both members started at the same size, so a proportional set-wide scale grows them by the
    // same ratio - the shared primitive maps every member the same way, never independently.
    const firstRatio = resizedFirst.width / firstBox.width
    const secondRatio = resizedSecond.width / secondBox.width

    expect(firstRatio).toBeGreaterThan(1.05)
    expect(Math.abs(firstRatio - secondRatio)).toBeLessThan(0.02)
  })

  test("resizing a group's own handle scales every child and keeps the group box a tight union", async ({
    page
  }) => {
    await createTemplateAndOpenEditor(page, `E2E set resize group ${Date.now()}`)
    await addRectangleBlock(page)
    await addRectangleBlock(page)

    const blocks = page.getByRole("button", { name: "Select Shape block" })
    const groups = page.getByRole("button", { name: "Select Group block" })

    await expect(blocks).toHaveCount(2)

    const firstBox = await blocks.nth(0).boundingBox()
    const secondBox = await blocks.nth(1).boundingBox()

    if (!firstBox || !secondBox) throw new Error("Shape blocks did not render bounding boxes")

    const marqueeStartX = Math.max(firstBox.x, secondBox.x) + 400
    const marqueeStartY = secondBox.y + secondBox.height + 24

    await page.mouse.move(marqueeStartX, marqueeStartY)
    await page.mouse.down()
    await page.mouse.move(firstBox.x + 8, firstBox.y + 8, { steps: 6 })
    await page.mouse.up()

    await page.keyboard.press("ControlOrMeta+g")

    await expect(groups).toHaveCount(1)

    const handle = page.getByRole("button", { name: "Resize block (se)" })
    const handleBox = await handle.boundingBox()

    if (!handleBox) throw new Error("Resize handle did not render a bounding box")

    const handleX = handleBox.x + handleBox.width / 2
    const handleY = handleBox.y + handleBox.height / 2

    await page.mouse.move(handleX, handleY)
    await page.mouse.down()
    await page.mouse.move(handleX + 80, handleY + 64, { steps: 6 })
    await page.mouse.up()

    const groupBox = await groups.first().boundingBox()
    const resizedFirst = await blocks.nth(0).boundingBox()
    const resizedSecond = await blocks.nth(1).boundingBox()

    if (!groupBox || !resizedFirst || !resizedSecond) {
      throw new Error("Group or member blocks lost their bounding boxes")
    }

    const unionX = Math.min(resizedFirst.x, resizedSecond.x)
    const unionY = Math.min(resizedFirst.y, resizedSecond.y)
    const unionRight = Math.max(
      resizedFirst.x + resizedFirst.width,
      resizedSecond.x + resizedSecond.width
    )
    const unionBottom = Math.max(
      resizedFirst.y + resizedFirst.height,
      resizedSecond.y + resizedSecond.height
    )

    expect(Math.abs(groupBox.x - unionX)).toBeLessThanOrEqual(1)
    expect(Math.abs(groupBox.y - unionY)).toBeLessThanOrEqual(1)
    expect(Math.abs(groupBox.x + groupBox.width - unionRight)).toBeLessThanOrEqual(1)
    expect(Math.abs(groupBox.y + groupBox.height - unionBottom)).toBeLessThanOrEqual(1)
  })

  test("a rotated member in the set falls back to a uniform, aspect-locked resize", async ({
    page
  }) => {
    await createTemplateAndOpenEditor(page, `E2E set resize uniform fallback ${Date.now()}`)
    await addRectangleBlock(page)
    await addRectangleBlock(page)

    const blocks = page.getByRole("button", { name: "Select Shape block" })

    await expect(blocks).toHaveCount(2)
    await blocks.nth(0).click()
    await page.getByLabel("Rotation").fill("30")
    await page.getByLabel("Rotation").blur()

    const firstBox = await blocks.nth(0).boundingBox()
    const secondBox = await blocks.nth(1).boundingBox()

    if (!firstBox || !secondBox) throw new Error("Shape blocks did not render bounding boxes")

    const aspectRatio = secondBox.width / secondBox.height

    const marqueeStartX = Math.max(firstBox.x, secondBox.x) + 400
    const marqueeStartY = secondBox.y + secondBox.height + 24

    await page.mouse.move(marqueeStartX, marqueeStartY)
    await page.mouse.down()
    await page.mouse.move(firstBox.x - 40, firstBox.y - 40, { steps: 6 })
    await page.mouse.up()

    await expect(blocks.nth(0)).toHaveAttribute("aria-pressed", "true")
    await expect(blocks.nth(1)).toHaveAttribute("aria-pressed", "true")

    const handle = page.getByRole("button", { name: "Resize block (se)" })
    const handleBox = await handle.boundingBox()

    if (!handleBox) throw new Error("Resize handle did not render a bounding box")

    const handleX = handleBox.x + handleBox.width / 2
    const handleY = handleBox.y + handleBox.height / 2

    // A deliberately asymmetric drag (much more horizontal than vertical movement) - a free
    // (non-uniform) resize would stretch width far more than height, changing the aspect ratio.
    await page.mouse.move(handleX, handleY)
    await page.mouse.down()
    await page.mouse.move(handleX + 120, handleY + 4, { steps: 6 })
    await page.mouse.up()

    const resizedSecond = await blocks.nth(1).boundingBox()

    if (!resizedSecond) throw new Error("Shape block lost its bounding box")

    const resizedAspectRatio = resizedSecond.width / resizedSecond.height

    expect(resizedSecond.width).toBeGreaterThan(secondBox.width * 1.05)
    expect(Math.abs(resizedAspectRatio - aspectRatio)).toBeLessThan(0.05)
  })
})
