import { expect, test } from "@playwright/test"

import { addOwnerSessionCookie } from "./support/ownerSession"
import { addRectangleBlock, createTemplateAndOpenEditor } from "./support/templateEditorFixture"

test.describe("template editor - group and ungroup", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    if (!baseURL) throw new Error("Playwright baseURL is required for owner session setup")

    await addOwnerSessionCookie(context, baseURL)
  })

  test("grouping a marquee selection moves the members together and ungrouping frees them", async ({
    page
  }) => {
    await createTemplateAndOpenEditor(page, `E2E group ${Date.now()}`)
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

    await expect(blocks.nth(0)).toHaveAttribute("aria-pressed", "true")
    await expect(blocks.nth(1)).toHaveAttribute("aria-pressed", "true")

    await page.keyboard.press("ControlOrMeta+g")

    await expect(groups).toHaveCount(1)

    const groupBox = await groups.first().boundingBox()

    if (!groupBox) throw new Error("Group block did not render a bounding box")

    // The group's box is the tight union of its members: it never authors a size of its own.
    const unionX = Math.min(firstBox.x, secondBox.x)
    const unionY = Math.min(firstBox.y, secondBox.y)

    expect(Math.abs(groupBox.x - unionX)).toBeLessThanOrEqual(1)
    expect(Math.abs(groupBox.y - unionY)).toBeLessThanOrEqual(1)

    const deltaX = 64
    const deltaY = 48

    await page.mouse.move(groupBox.x + groupBox.width / 2, groupBox.y + groupBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(
      groupBox.x + groupBox.width / 2 + deltaX,
      groupBox.y + groupBox.height / 2 + deltaY,
      { steps: 6 }
    )
    await page.mouse.up()

    const movedGroup = await groups.first().boundingBox()

    if (!movedGroup) throw new Error("Group block lost its bounding box")

    expect(Math.abs(movedGroup.x - (groupBox.x + deltaX))).toBeLessThanOrEqual(1)
    expect(Math.abs(movedGroup.y - (groupBox.y + deltaY))).toBeLessThanOrEqual(1)
    expect(Math.abs(movedGroup.width - groupBox.width)).toBeLessThanOrEqual(1)
    expect(Math.abs(movedGroup.height - groupBox.height)).toBeLessThanOrEqual(1)

    await page.keyboard.press("ControlOrMeta+Shift+g")

    await expect(groups).toHaveCount(0)
    await expect(blocks).toHaveCount(2)

    const freedFirst = await blocks.nth(0).boundingBox()
    const freedSecond = await blocks.nth(1).boundingBox()

    if (!freedFirst || !freedSecond) throw new Error("Freed blocks did not render bounding boxes")

    // Every member carried the group's move, and ungrouping restores them at their moved position.
    expect(Math.abs(freedFirst.x - (firstBox.x + deltaX))).toBeLessThanOrEqual(1)
    expect(Math.abs(freedFirst.y - (firstBox.y + deltaY))).toBeLessThanOrEqual(1)
    expect(Math.abs(freedSecond.x - (secondBox.x + deltaX))).toBeLessThanOrEqual(1)
    expect(Math.abs(freedSecond.y - (secondBox.y + deltaY))).toBeLessThanOrEqual(1)
  })

  test("the context menu's Group selection item groups a marquee selection the same way the hotkey does", async ({
    page
  }) => {
    await createTemplateAndOpenEditor(page, `E2E context menu group ${Date.now()}`)
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

    await expect(blocks.nth(0)).toHaveAttribute("aria-pressed", "true")
    await expect(blocks.nth(1)).toHaveAttribute("aria-pressed", "true")

    await blocks.nth(0).click({ button: "right" })

    const menu = page.getByRole("menu")

    await expect(menu).toBeVisible()
    await menu.getByRole("menuitem", { name: "Group selection" }).click()

    await expect(groups).toHaveCount(1)

    // The two shapes still exist and stay accessible - now as the group's nested children rather
    // than top-level blocks.
    await expect(blocks).toHaveCount(2)
  })

  test("undo reverses a group and a subsequent move as two separate steps, in order", async ({
    page
  }) => {
    await createTemplateAndOpenEditor(page, `E2E undo depth ${Date.now()}`)
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

    const groupBoxBeforeMove = await groups.first().boundingBox()

    if (!groupBoxBeforeMove) throw new Error("Group block did not render a bounding box")

    const deltaX = 64
    const deltaY = 48

    await page.mouse.move(
      groupBoxBeforeMove.x + groupBoxBeforeMove.width / 2,
      groupBoxBeforeMove.y + groupBoxBeforeMove.height / 2
    )
    await page.mouse.down()
    await page.mouse.move(
      groupBoxBeforeMove.x + groupBoxBeforeMove.width / 2 + deltaX,
      groupBoxBeforeMove.y + groupBoxBeforeMove.height / 2 + deltaY,
      { steps: 6 }
    )
    await page.mouse.up()

    const groupBoxAfterMove = await groups.first().boundingBox()

    if (!groupBoxAfterMove) throw new Error("Group block lost its bounding box")

    expect(Math.abs(groupBoxAfterMove.x - (groupBoxBeforeMove.x + deltaX))).toBeLessThanOrEqual(1)

    // First undo reverses only the move - the group still exists at its pre-move position.
    await page.keyboard.press("ControlOrMeta+z")

    await expect(groups).toHaveCount(1)

    const groupBoxAfterFirstUndo = await groups.first().boundingBox()

    if (!groupBoxAfterFirstUndo) throw new Error("Group block lost its bounding box")

    expect(Math.abs(groupBoxAfterFirstUndo.x - groupBoxBeforeMove.x)).toBeLessThanOrEqual(1)
    expect(Math.abs(groupBoxAfterFirstUndo.y - groupBoxBeforeMove.y)).toBeLessThanOrEqual(1)

    // Second undo reverses the group itself, restoring the two separate blocks.
    await page.keyboard.press("ControlOrMeta+z")

    await expect(groups).toHaveCount(0)
    await expect(blocks).toHaveCount(2)
  })
})
