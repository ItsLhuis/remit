import { expect, test, type Page } from "@playwright/test"

import { addOwnerSessionCookie } from "./support/ownerSession"
import { addRectangleBlock, createTemplateAndOpenEditor } from "./support/templateEditorFixture"

const BLOCK_COUNT = 32
const DRAG_STEPS = 40
const STEP_INTERVAL_MS = 20

// A single hiccup is tolerated (headless scheduling, garbage collection); a re-render storm shows up
// as consecutive long frames, which is what a "dropped-frame burst" means here.
const LONG_FRAME_MS = 50
const WORST_FRAME_MS = 100
const MIN_SAMPLED_FRAMES = 30

type FrameTraceWindow = Window & {
  __frameTrace?: { times: number[]; running: boolean }
}

async function startFrameTrace(page: Page): Promise<void> {
  await page.evaluate(() => {
    const traced = window as FrameTraceWindow
    const trace = { times: [] as number[], running: true }

    traced.__frameTrace = trace

    const tick = (time: number) => {
      if (!trace.running) return

      trace.times.push(time)
      requestAnimationFrame(tick)
    }

    requestAnimationFrame(tick)
  })
}

async function stopFrameTrace(page: Page): Promise<number[]> {
  return page.evaluate(() => {
    const trace = (window as FrameTraceWindow).__frameTrace

    if (!trace) return []

    trace.running = false

    return trace.times
  })
}

function frameIntervals(times: readonly number[]): number[] {
  return times.slice(1).map((time, index) => time - times[index])
}

function longestBurst(intervals: readonly number[], threshold: number): number {
  let longest = 0
  let current = 0

  for (const interval of intervals) {
    current = interval > threshold ? current + 1 : 0
    longest = Math.max(longest, current)
  }

  return longest
}

test.describe("template editor - frame continuity", () => {
  test.slow()

  test.beforeEach(async ({ context, baseURL }) => {
    if (!baseURL) throw new Error("Playwright baseURL is required for owner session setup")

    await addOwnerSessionCookie(context, baseURL)
  })

  test("dragging among 32 blocks keeps frames continuous with no dropped-frame burst", async ({
    page
  }, testInfo) => {
    await createTemplateAndOpenEditor(page, `E2E frames ${Date.now()}`)
    await addRectangleBlock(page)

    const blocks = page.getByRole("button", { name: "Select Shape block" })

    await blocks.first().click()

    for (let index = 1; index < BLOCK_COUNT; index += 1) {
      await page.keyboard.press("ControlOrMeta+d")
    }

    await expect(blocks).toHaveCount(BLOCK_COUNT)

    // The last block is topmost in z-order, so a press at its own centre reaches it rather than a
    // clone stacked above it; duplicates cascade down-right and clamp at the page edge, so the drag
    // travels back up-left where there is room to move.
    const dragged = blocks.last()
    const startBox = await dragged.boundingBox()

    if (!startBox) throw new Error("Shape block did not render a bounding box")

    const startX = startBox.x + startBox.width / 2
    const startY = startBox.y + startBox.height / 2
    const deltaX = -160
    const deltaY = -120

    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(startX + deltaX / DRAG_STEPS, startY + deltaY / DRAG_STEPS)

    // Traced from the second drag step on: an idle page produces no damage, so the frames before the
    // gesture starts painting say nothing about how the engine behaves under one.
    await startFrameTrace(page)

    for (let step = 2; step <= DRAG_STEPS; step += 1) {
      await page.mouse.move(
        startX + (deltaX * step) / DRAG_STEPS,
        startY + (deltaY * step) / DRAG_STEPS
      )
      await page.waitForTimeout(STEP_INTERVAL_MS)
    }

    await page.mouse.up()

    const times = await stopFrameTrace(page)

    // The trailing interval spans the boundary between the last dragged frame and the round trip
    // that stops the trace, where the page is idle again and produces no damage.
    const intervals = frameIntervals(times).slice(0, -1)
    const worst = Math.max(...intervals)

    const endBox = await dragged.boundingBox()

    if (!endBox) throw new Error("Shape block lost its bounding box after the drag")

    expect(Math.abs(endBox.x - startBox.x)).toBeGreaterThan(1)

    // The plan's performance item asks for recorded evidence, not just a pass/fail.
    testInfo.annotations.push({
      type: "frame-trace",
      description: `frames=${intervals.length} worst=${worst.toFixed(1)}ms@${intervals.indexOf(worst)} long=${intervals.filter((interval) => interval > LONG_FRAME_MS).length}`
    })

    expect(intervals.length).toBeGreaterThanOrEqual(MIN_SAMPLED_FRAMES)
    expect(worst).toBeLessThan(WORST_FRAME_MS)
    expect(longestBurst(intervals, LONG_FRAME_MS)).toBeLessThan(2)
  })
})
