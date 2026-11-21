// @vitest-environment happy-dom

import { useEffect } from "react"

import { act, cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { afterEach, beforeAll, expect, test, vi } from "vitest"

import { useTemplateEditor } from "../../../../hooks"
import { type Block, type TemplateType } from "../../../../schemas"
import { addBlock, getContentBounds, DEFAULT_PAGE_SETTINGS } from "../../../../services"
import { PropertyPanel } from "../PropertyPanel"

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {},
    ready: true,
    locales: {}
  })
}))

// ImageBlockField drives the presign/confirm upload flow through the server mutations module,
// whose auth import validates env at load time; the upload flow is out of scope here.
vi.mock("../../ImageBlockField", () => ({
  ImageBlockField: () => null
}))

const bounds = getContentBounds("invoice", DEFAULT_PAGE_SETTINGS)

type EditorState = ReturnType<typeof useTemplateEditor>

type HarnessProps = {
  initialBlocks: Block[]
  type: TemplateType
  selectFirst?: boolean
  selectAll?: boolean
  onEditor?: (editor: EditorState) => void
}

const Harness = ({
  initialBlocks,
  type,
  selectFirst = true,
  selectAll,
  onEditor
}: HarnessProps) => {
  const editor = useTemplateEditor(initialBlocks, type, DEFAULT_PAGE_SETTINGS)

  const firstBlockId = initialBlocks[0]?.id ?? null
  const allIds = initialBlocks.map((block) => block.id).join(",")
  const { selectBlock, setSelection } = editor

  useEffect(() => {
    if (selectAll) {
      setSelection(allIds.split(","))

      return
    }

    if (selectFirst && firstBlockId) selectBlock(firstBlockId)
  }, [selectAll, allIds, setSelection, selectFirst, firstBlockId, selectBlock])

  useEffect(() => {
    onEditor?.(editor)
  })

  return (
    <PropertyPanel
      editor={editor}
      type={type}
      assets={{}}
      isEmail={false}
      subject=""
      onSubjectChange={() => {}}
    />
  )
}

beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn()

  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
})

afterEach(() => {
  cleanup()
})

test("round-trips a text block's content edit through the editor state", async () => {
  const user = userEvent.setup()
  const { blocks } = addBlock([], "text", bounds)

  render(<Harness initialBlocks={blocks} type="invoice" />)

  const input = screen.getByLabelText("templates.editor.richText")

  await user.type(input, "Payment summary")

  expect(input).toHaveValue("Payment summary")
})

test("offers the merge-variable picker on text and table blocks", () => {
  for (const type of ["text", "table"] as const) {
    const { blocks } = addBlock([], type, bounds)

    render(<Harness initialBlocks={blocks} type="invoice" />)

    expect(
      screen.getByRole("button", { name: "templates.mergeVariables.insertVariable" })
    ).toBeInTheDocument()

    cleanup()
  }
})

test("renders style sections from the capability registry", () => {
  const { blocks } = addBlock([], "image", bounds)

  render(<Harness initialBlocks={blocks} type="invoice" />)

  expect(screen.getByText("templates.editor.sectionAppearance")).toBeInTheDocument()
  expect(screen.queryByText("templates.editor.sectionTypography")).not.toBeInTheDocument()
})

test("exposes editable rectangle fields on a selected block", () => {
  const { blocks } = addBlock([], "image", bounds)

  render(<Harness initialBlocks={blocks} type="invoice" />)

  expect(screen.getByLabelText("templates.editor.positionX")).toBeInTheDocument()
  expect(screen.getByLabelText("templates.editor.positionY")).toBeInTheDocument()
  expect(screen.getByLabelText("templates.editor.sizeWidth")).toBeInTheDocument()
  expect(screen.getByLabelText("templates.editor.sizeHeight")).toBeInTheDocument()
})

test("offers the frame content editor with the clip toggle and child add buttons", () => {
  const { blocks } = addBlock([], "frame", bounds)

  render(<Harness initialBlocks={blocks} type="invoice" />)

  expect(screen.getByLabelText("templates.editor.frameClip")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: /templates\.blocks\.image/ })).toBeInTheDocument()
})

test("hides the line-items table source on a type without line items", () => {
  const { blocks } = addBlock([], "table", bounds)

  render(<Harness initialBlocks={blocks} type="contract" />)

  expect(screen.queryByText("templates.editor.tableSourceLineItems")).not.toBeInTheDocument()
})

test("shows page settings when nothing is selected", () => {
  render(<Harness initialBlocks={[]} type="invoice" selectFirst={false} />)

  expect(screen.getByText("templates.pageSettings.title")).toBeInTheDocument()
  expect(screen.getByLabelText("templates.pageSettings.marginTop")).toBeInTheDocument()
})

function makeMultiBlocks(): Block[] {
  const { blocks: withText } = addBlock([], "text", bounds)
  const { blocks } = addBlock(withText, "image", bounds)

  return blocks
}

test("renders only the shared property groups for a mixed-type multi-selection", () => {
  render(<Harness initialBlocks={makeMultiBlocks()} type="invoice" selectAll />)

  expect(screen.getByText("templates.editor.multiSelectionTitle")).toBeInTheDocument()
  expect(screen.getByText("templates.editor.sectionSpacing")).toBeInTheDocument()
  expect(screen.getByText("templates.editor.sectionAppearance")).toBeInTheDocument()
  expect(screen.queryByText("templates.editor.sectionTypography")).not.toBeInTheDocument()
})

test("shows the Mixed placeholder when selected blocks disagree on a field", () => {
  const blocks = makeMultiBlocks()
  const first = blocks[0]

  if (!first || first.type === "group") throw new Error("expected a styleable block")

  const styled: Block[] = [{ ...first, style: { borderWidth: 4 } }, ...blocks.slice(1)]

  render(<Harness initialBlocks={styled} type="invoice" selectAll />)

  expect(screen.getByLabelText("templates.editor.borderWidth")).toHaveAttribute(
    "placeholder",
    "templates.editor.mixedValue"
  )
})

test("committing a multi-selection field writes to every member as one undo entry", async () => {
  const user = userEvent.setup()
  const captured = { editor: null as EditorState | null }

  render(
    <Harness
      initialBlocks={makeMultiBlocks()}
      type="invoice"
      selectAll
      onEditor={(editor) => {
        captured.editor = editor
      }}
    />
  )

  const input = screen.getByLabelText("templates.editor.borderWidth")

  await user.type(input, "4")

  expect(
    captured.editor?.blocks.every(
      (block) => block.type !== "group" && block.style?.borderWidth === 4
    )
  ).toBe(true)

  act(() => {
    captured.editor?.undo()
  })

  expect(
    captured.editor?.blocks.every((block) => block.type === "group" || block.style === undefined)
  ).toBe(true)
  expect(captured.editor?.canUndo).toBe(false)
})
