// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react"

import { afterEach, expect, test, vi } from "vitest"

import { makeTextBlock } from "@/tests/factories/blocks"

import { TEXT_HTML_MAX_LENGTH } from "../../../schemas"
import { CanvasTextEditor } from "../CanvasTextEditor"

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {},
    ready: true,
    locales: {}
  })
}))

function makeText(html: string) {
  const block = makeTextBlock({ content: { html } })

  if (block.type !== "text") throw new Error("expected a text block")

  return block
}

// Replaces the editable surface's content with `text`, collapses the caret to the very end (the
// position a real keystroke would leave it at), and fires the native input event the component
// listens for - simulating typing without needing a full keyboard-event-per-character sequence.
function typeAndCollapse(editable: HTMLElement, text: string) {
  editable.textContent = text

  const textNode = editable.firstChild

  if (!textNode) return

  const range = document.createRange()

  range.setStart(textNode, text.length)
  range.collapse(true)

  const selection = window.getSelection()

  selection?.removeAllRanges()
  selection?.addRange(range)

  fireEvent.input(editable)
}

function renderEditor(
  html: string,
  overrides: { onCommit?: (html: string) => void; onExit?: () => void } = {}
) {
  const onCommit = overrides.onCommit ?? vi.fn()
  const onExit = overrides.onExit ?? vi.fn()

  render(
    <CanvasTextEditor
      block={makeText(html)}
      type="invoice"
      caretPoint={null}
      onCommit={onCommit}
      onExit={onExit}
    />
  )

  return { onCommit, onExit, editable: screen.getByRole("textbox") }
}

afterEach(() => {
  cleanup()
})

test("seeds the raw stored html so merge tokens appear in their literal form", () => {
  const { editable } = renderEditor("Hello {{client.name}}")

  expect(editable.textContent).toBe("Hello {{client.name}}")
})

test("commits the edited content and exits on blur", () => {
  const { editable, onCommit, onExit } = renderEditor("Hello")

  editable.innerHTML = "<p>Updated</p>"
  fireEvent.blur(editable)

  expect(onCommit).toHaveBeenCalledWith("<p>Updated</p>")
  expect(onExit).toHaveBeenCalledTimes(1)
})

test("strips a pasted script tag before the content ever reaches the commit callback", () => {
  const { editable, onCommit } = renderEditor("Hello")

  editable.innerHTML = '<p>Hi</p><script>alert("xss")</script>'
  fireEvent.blur(editable)

  expect(onCommit).toHaveBeenCalledWith("<p>Hi</p>")
})

test("commits only once when blur follows an Escape commit", () => {
  const { editable, onCommit, onExit } = renderEditor("Hello")

  fireEvent.keyDown(editable, { key: "Escape" })
  fireEvent.blur(editable)

  expect(onCommit).toHaveBeenCalledTimes(1)
  expect(onExit).toHaveBeenCalledTimes(1)
})

test("Escape stops the keydown from propagating to an ancestor listener", () => {
  const ancestorHandler = vi.fn()
  const block = makeText("Hello")

  render(
    <div onKeyDown={ancestorHandler}>
      <CanvasTextEditor
        block={block}
        type="invoice"
        caretPoint={null}
        onCommit={vi.fn()}
        onExit={vi.fn()}
      />
    </div>
  )

  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" })

  expect(ancestorHandler).not.toHaveBeenCalled()
})

test("lets Mod+S reach an ancestor listener so the page save hotkey stays reachable while editing", () => {
  const ancestorHandler = vi.fn()
  const block = makeText("Hello")

  render(
    <div onKeyDown={ancestorHandler}>
      <CanvasTextEditor
        block={block}
        type="invoice"
        caretPoint={null}
        onCommit={vi.fn()}
        onExit={vi.fn()}
      />
    </div>
  )

  fireEvent.keyDown(screen.getByRole("textbox"), { key: "s", metaKey: true })

  expect(ancestorHandler).toHaveBeenCalledTimes(1)
})

test("lets Mod+P reach an ancestor listener so the preview toggle stays reachable while editing", () => {
  const ancestorHandler = vi.fn()
  const block = makeText("Hello")

  render(
    <div onKeyDown={ancestorHandler}>
      <CanvasTextEditor
        block={block}
        type="invoice"
        caretPoint={null}
        onCommit={vi.fn()}
        onExit={vi.fn()}
      />
    </div>
  )

  fireEvent.keyDown(screen.getByRole("textbox"), { key: "p", metaKey: true })

  expect(ancestorHandler).toHaveBeenCalledTimes(1)
})

test("stops Mod+Z from propagating so native text undo wins over the page undo hotkey", () => {
  const ancestorHandler = vi.fn()
  const block = makeText("Hello")

  render(
    <div onKeyDown={ancestorHandler}>
      <CanvasTextEditor
        block={block}
        type="invoice"
        caretPoint={null}
        onCommit={vi.fn()}
        onExit={vi.fn()}
      />
    </div>
  )

  fireEvent.keyDown(screen.getByRole("textbox"), { key: "z", metaKey: true })

  expect(ancestorHandler).not.toHaveBeenCalled()
})

test("stops Mod+D from propagating so the page duplicate hotkey never fires mid-edit", () => {
  const ancestorHandler = vi.fn()
  const block = makeText("Hello")

  render(
    <div onKeyDown={ancestorHandler}>
      <CanvasTextEditor
        block={block}
        type="invoice"
        caretPoint={null}
        onCommit={vi.fn()}
        onExit={vi.fn()}
      />
    </div>
  )

  fireEvent.keyDown(screen.getByRole("textbox"), { key: "d", metaKey: true })

  expect(ancestorHandler).not.toHaveBeenCalled()
})

test("restores focus to the caller-provided target after committing", () => {
  const block = makeText("Hello")
  const wrapper = document.createElement("button")

  document.body.appendChild(wrapper)

  render(
    <CanvasTextEditor
      block={block}
      type="invoice"
      caretPoint={null}
      onCommit={vi.fn()}
      onExit={() => wrapper.focus()}
    />
  )

  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" })

  expect(wrapper).toHaveFocus()

  wrapper.remove()
})

test("allows typing below the max length", () => {
  const { editable } = renderEditor("short")

  const event = new InputEvent("beforeinput", {
    inputType: "insertText",
    data: "x",
    bubbles: true,
    cancelable: true
  })

  const notPrevented = editable.dispatchEvent(event)

  expect(notPrevented).toBe(true)
})

test("blocks input that would push the content past the max length", () => {
  const { editable } = renderEditor("x".repeat(TEXT_HTML_MAX_LENGTH))

  const event = new InputEvent("beforeinput", {
    inputType: "insertText",
    data: "y",
    bubbles: true,
    cancelable: true
  })

  const notPrevented = editable.dispatchEvent(event)

  expect(notPrevented).toBe(false)
})

test("blocks a paste that would push the content past the max length even though current length is under the cap", () => {
  const { editable } = renderEditor("x".repeat(TEXT_HTML_MAX_LENGTH - 5))

  const event = new InputEvent("beforeinput", {
    inputType: "insertFromPaste",
    bubbles: true,
    cancelable: true
  })

  Object.defineProperty(event, "dataTransfer", {
    value: { getData: () => "y".repeat(1000) }
  })

  const notPrevented = editable.dispatchEvent(event)

  expect(notPrevented).toBe(false)
})

test("does not block a deletion at the max length", () => {
  const { editable } = renderEditor("x".repeat(TEXT_HTML_MAX_LENGTH))

  const event = new InputEvent("beforeinput", {
    inputType: "deleteContentBackward",
    bubbles: true,
    cancelable: true
  })

  const notPrevented = editable.dispatchEvent(event)

  expect(notPrevented).toBe(true)
})

test("opens the merge variable autocomplete listing every variable once {{ is typed", () => {
  const { editable } = renderEditor("Hello")

  typeAndCollapse(editable, "Hello {{")

  expect(screen.getByText("templates.mergeVariables.labels.clientName")).toBeInTheDocument()
})

test("filters the autocomplete list by the characters typed after {{", () => {
  const { editable } = renderEditor("Hello")

  typeAndCollapse(editable, "Hello {{business")

  expect(screen.getByText("templates.mergeVariables.labels.businessName")).toBeInTheDocument()
  expect(screen.queryByText("templates.mergeVariables.labels.clientName")).not.toBeInTheDocument()
})

test("closes the autocomplete once the query contains a space", () => {
  const { editable } = renderEditor("Hello")

  typeAndCollapse(editable, "Hello {{client ")

  expect(screen.queryByText("templates.mergeVariables.labels.clientName")).not.toBeInTheDocument()
})

test("Enter inserts the highlighted suggestion's token at the caret without exiting the block", () => {
  const onCommit = vi.fn()
  const onExit = vi.fn()
  const { editable } = renderEditor("Hello", { onCommit, onExit })

  typeAndCollapse(editable, "Hello {{")
  fireEvent.keyDown(editable, { key: "Enter" })

  expect(editable.textContent).toBe("Hello {{client.name}}")
  expect(onCommit).not.toHaveBeenCalled()
  expect(onExit).not.toHaveBeenCalled()
})

test("ArrowDown moves the highlight to the next suggestion before Enter inserts it", () => {
  const { editable } = renderEditor("Hello")

  typeAndCollapse(editable, "Hello {{")
  fireEvent.keyDown(editable, { key: "ArrowDown" })
  fireEvent.keyDown(editable, { key: "Enter" })

  expect(editable.textContent).toBe("Hello {{client.email}}")
})

test("clicking a suggestion inserts its token and closes the popover", () => {
  const { editable } = renderEditor("Hello")

  typeAndCollapse(editable, "Hello {{business")
  fireEvent.click(screen.getByText("templates.mergeVariables.labels.businessName"))

  expect(editable.textContent).toBe("Hello {{business.name}}")
  expect(screen.queryByText("templates.mergeVariables.labels.businessName")).not.toBeInTheDocument()
})

test("Escape closes only the popover, leaving the block in edit mode", () => {
  const onCommit = vi.fn()
  const onExit = vi.fn()
  const { editable } = renderEditor("Hello", { onCommit, onExit })

  typeAndCollapse(editable, "Hello {{")
  fireEvent.keyDown(editable, { key: "Escape" })

  expect(screen.queryByText("templates.mergeVariables.labels.clientName")).not.toBeInTheDocument()
  expect(onCommit).not.toHaveBeenCalled()
  expect(onExit).not.toHaveBeenCalled()
})

test("a second Escape after the popover closes still commits and exits the block", () => {
  const onCommit = vi.fn()
  const onExit = vi.fn()
  const { editable } = renderEditor("Hello", { onCommit, onExit })

  typeAndCollapse(editable, "Hello {{")
  fireEvent.keyDown(editable, { key: "Escape" })
  fireEvent.keyDown(editable, { key: "Escape" })

  expect(onCommit).toHaveBeenCalledTimes(1)
  expect(onExit).toHaveBeenCalledTimes(1)
})
