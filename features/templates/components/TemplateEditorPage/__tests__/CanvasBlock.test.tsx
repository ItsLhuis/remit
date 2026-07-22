// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { afterEach, expect, test, vi } from "vitest"

import { type EditorInteraction } from "../../../hooks"
import { type Block } from "../../../schemas"
import {
  addBlock,
  buildSampleRenderData,
  getContentBounds,
  renderBlockContent,
  DEFAULT_PAGE_SETTINGS
} from "../../../services"
import { CanvasBlock } from "../CanvasBlock"

// Wrap the real renderer in a spy so a test can count how many times a block's HTML is recomputed.
vi.mock("../../../services", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../services")>()

  return { ...actual, renderBlockContent: vi.fn(actual.renderBlockContent) }
})

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {},
    ready: true,
    locales: {}
  })
}))

const bounds = getContentBounds("invoice", DEFAULT_PAGE_SETTINGS)

function makeText(): Block {
  const { blocks } = addBlock([], "text", bounds)
  const block = blocks[0]

  if (!block) throw new Error("expected a block")

  return block
}

function makeHandlers() {
  return {
    onRegisterNode: vi.fn(),
    onSyncMinHeight: vi.fn(),
    onSelect: vi.fn(),
    onSetTextContent: vi.fn(),
    onNudge: vi.fn(),
    onMoveBy: vi.fn(),
    onResizeBy: vi.fn(),
    onRemove: vi.fn(),
    onDescend: vi.fn(() => null),
    onAscend: vi.fn(() => null)
  }
}

// A no-op stub of the interaction store's overlay surface (block hotkeys read
// getOverlay/subscribeOverlay to gate on an in-flight gesture; no gesture is active in these tests).
function makeInteraction(selectedId?: string): EditorInteraction {
  return {
    selection: selectedId ? new Set([selectedId]) : new Set(),
    select: vi.fn(),
    toggleSelected: vi.fn(),
    setSelection: vi.fn(),
    setHovered: vi.fn(),
    registerNode: vi.fn(),
    getNode: vi.fn(() => null),
    focusNode: vi.fn(),
    setOverlay: vi.fn(),
    getOverlay: vi.fn(() => ({
      gesture: null,
      guides: [],
      liveRects: null,
      hoveredId: null,
      marquee: null,
      rotationBadge: null
    })),
    subscribeOverlay: vi.fn(() => () => {}),
    editingTextId: null,
    editingTextCaretPoint: null,
    startTextEdit: vi.fn(),
    endTextEdit: vi.fn()
  }
}

function renderCanvasBlock(block: Block) {
  const handlers = makeHandlers()

  render(
    <CanvasBlock
      block={block}
      margins={{ top: 32, left: 32 }}
      type="invoice"
      renderData={buildSampleRenderData("invoice")}
      assets={{}}
      interaction={makeInteraction(block.id)}
      {...handlers}
    />
  )

  return handlers
}

afterEach(() => {
  cleanup()
})

test("nudges one grid cell with a plain arrow key", async () => {
  const user = userEvent.setup()
  const block = makeText()

  const handlers = renderCanvasBlock(block)

  const surface = screen.getByRole("button", { name: /templates\.editor\.selectBlock/ })

  surface.focus()
  await user.keyboard("{ArrowDown}")

  expect(handlers.onNudge).toHaveBeenCalledWith([block.id], 0, 1)
})

test("nudges ten whole pixels with Shift and an arrow key", async () => {
  const user = userEvent.setup()
  const block = makeText()

  const handlers = renderCanvasBlock(block)

  const surface = screen.getByRole("button", { name: /templates\.editor\.selectBlock/ })

  surface.focus()
  await user.keyboard("{Shift>}{ArrowRight}{/Shift}")

  expect(handlers.onMoveBy).toHaveBeenCalledWith([block.id], 10, 0)
})

test("resizes by one grid cell with Control and an arrow key", async () => {
  const user = userEvent.setup()
  const block = makeText()

  const handlers = renderCanvasBlock(block)

  const surface = screen.getByRole("button", { name: /templates\.editor\.selectBlock/ })

  surface.focus()
  await user.keyboard("{Control>}{ArrowRight}{/Control}")

  expect(handlers.onResizeBy).toHaveBeenCalledWith(block.id, 1, 0)
})

test("removes the block with the Delete key", async () => {
  const user = userEvent.setup()
  const block = makeText()

  const handlers = renderCanvasBlock(block)

  const surface = screen.getByRole("button", { name: /templates\.editor\.selectBlock/ })

  surface.focus()
  await user.keyboard("{Delete}")

  expect(handlers.onRemove).toHaveBeenCalledWith([block.id])
})

test("registers its wrapper element for the engine's transform writes", () => {
  const block = makeText()

  const handlers = renderCanvasBlock(block)

  expect(handlers.onRegisterNode).toHaveBeenCalledWith(block.id, expect.any(HTMLElement))
})

test("renders no interactive surface for locked or hidden blocks", () => {
  const block = makeText()

  renderCanvasBlock({ ...block, locked: true })

  expect(
    screen.queryByRole("button", { name: /templates\.editor\.selectBlock/ })
  ).not.toBeInTheDocument()

  cleanup()

  renderCanvasBlock({ ...block, hidden: true })

  expect(
    screen.queryByRole("button", { name: /templates\.editor\.selectBlock/ })
  ).not.toBeInTheDocument()
})

test("does not recompute block HTML when only selection-related props change", () => {
  const block = makeText()
  const renderData = buildSampleRenderData("invoice")
  const assets = {}
  const handlers = makeHandlers()
  const props = {
    block,
    margins: { top: 32, left: 32 },
    type: "invoice" as const,
    renderData,
    assets,
    ...handlers
  }

  vi.mocked(renderBlockContent).mockClear()

  const { rerender } = render(<CanvasBlock {...props} interaction={makeInteraction()} />)
  const callsAfterMount = vi.mocked(renderBlockContent).mock.calls.length

  rerender(<CanvasBlock {...props} interaction={makeInteraction(block.id)} />)

  expect(vi.mocked(renderBlockContent).mock.calls.length).toBe(callsAfterMount)
})
