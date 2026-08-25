import { cleanup, fireEvent, render, screen } from "@testing-library/react"

import { afterEach, describe, expect, test, vi } from "vitest"

import { axe } from "vitest-axe"

import { FileDropzone } from "../FileDropzone"

const ACCEPT = ["image/png", "application/pdf"] as const

function makeFile(name: string, type = "image/png"): File {
  return new File(["x"], name, { type })
}

function renderDropzone(props: Partial<Parameters<typeof FileDropzone>[0]> = {}) {
  const onFiles = vi.fn()

  const result = render(
    <FileDropzone
      accept={ACCEPT}
      label="Drop files here or browse"
      dropLabel="Drop to attach"
      description="Up to 20 files"
      onFiles={onFiles}
      {...props}
    />
  )

  const input = screen.getByLabelText(/browse/)

  return { ...result, onFiles, input, zone: input.closest("label") }
}

function drop(zone: Element, files: File[]): void {
  fireEvent.drop(zone, { dataTransfer: { files } })
}

afterEach(cleanup)

// A hand-written primitive rather than a shadcn or Radix wrapper, and it clears Tier 4 on two
// counts: the drag-depth counter is a state machine a child element can break, and the keyboard
// path exists only because the drop target is a `<label>` for a real file input.
describe("FileDropzone", () => {
  test("has no accessibility violations", async () => {
    const { container } = renderDropzone()

    expect((await axe(container)).violations).toEqual([])
  })

  test("names the file input for a keyboard and screen reader user", () => {
    const { input } = renderDropzone()

    expect(input).toHaveAttribute("type", "file")
    expect(input).toHaveAttribute("accept", "image/png,application/pdf")
  })

  test("hands every dropped file to the caller in multiple mode", () => {
    const { onFiles, zone } = renderDropzone({ multiple: true })

    if (zone) drop(zone, [makeFile("a.png"), makeFile("b.png")])

    expect(onFiles).toHaveBeenCalledWith([
      expect.objectContaining({ name: "a.png" }),
      expect.objectContaining({ name: "b.png" })
    ])
  })

  test("keeps only the first dropped file in single mode", () => {
    const { onFiles, zone } = renderDropzone()

    if (zone) drop(zone, [makeFile("a.png"), makeFile("b.png")])

    expect(onFiles).toHaveBeenCalledWith([expect.objectContaining({ name: "a.png" })])
  })

  test("ignores a drop while disabled", () => {
    const { onFiles, zone } = renderDropzone({ disabled: true })

    if (zone) drop(zone, [makeFile("a.png")])

    expect(onFiles).not.toHaveBeenCalled()
  })

  test("swaps the label text while a file is dragged over it", () => {
    const { zone } = renderDropzone()

    if (zone) fireEvent.dragEnter(zone)

    expect(screen.getByText("Drop to attach")).toBeInTheDocument()
  })

  test("stays in the drag state while the pointer crosses a child element", () => {
    const { zone } = renderDropzone()

    if (zone) {
      fireEvent.dragEnter(zone)
      fireEvent.dragEnter(zone)
      fireEvent.dragLeave(zone)
    }

    expect(screen.getByText("Drop to attach")).toBeInTheDocument()
  })

  test("leaves the drag state once the last drag leaves", () => {
    const { zone } = renderDropzone()

    if (zone) {
      fireEvent.dragEnter(zone)
      fireEvent.dragLeave(zone)
    }

    expect(screen.getByText("Drop files here or browse")).toBeInTheDocument()
  })

  test("shows no drag state while disabled", () => {
    const { zone } = renderDropzone({ disabled: true })

    if (zone) fireEvent.dragEnter(zone)

    expect(screen.getByText("Drop files here or browse")).toBeInTheDocument()
  })
})
