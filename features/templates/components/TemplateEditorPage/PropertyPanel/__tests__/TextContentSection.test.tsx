// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react"

import { afterEach, expect, test, vi } from "vitest"

import { makeTextBlock } from "@/tests/factories/blocks"

import { TEXT_HTML_MAX_LENGTH } from "../../../../schemas"
import { TextContentSection } from "../TextContentSection"

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

afterEach(() => {
  cleanup()
})

test("blocks a textarea edit that would push the content past the max length", () => {
  const onChange = vi.fn()
  const block = makeText("short")

  render(<TextContentSection block={block} type="invoice" onChange={onChange} />)

  const textarea = screen.getByLabelText("templates.editor.richText")

  fireEvent.change(textarea, { target: { value: "x".repeat(TEXT_HTML_MAX_LENGTH + 1) } })

  expect(onChange).not.toHaveBeenCalled()
})

test("allows a textarea edit at or under the max length", () => {
  const onChange = vi.fn()
  const block = makeText("short")

  render(<TextContentSection block={block} type="invoice" onChange={onChange} />)

  const textarea = screen.getByLabelText("templates.editor.richText")

  fireEvent.change(textarea, { target: { value: "x".repeat(TEXT_HTML_MAX_LENGTH) } })

  expect(onChange).toHaveBeenCalledTimes(1)
})
