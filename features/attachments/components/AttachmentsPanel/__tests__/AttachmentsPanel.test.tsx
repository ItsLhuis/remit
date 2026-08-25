import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { afterEach, describe, expect, test, vi } from "vitest"

import { axe } from "vitest-axe"

import { TooltipProvider } from "@/components/ui"

import { type AttachmentListItem } from "../../../types"
import { AttachmentsPanel } from "../AttachmentsPanel"

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {},
    ready: true,
    locales: {}
  })
}))

vi.mock("../../../mutations", () => ({
  addAttachment: vi.fn(),
  removeAttachment: vi.fn()
}))

const PARENT = { parentType: "client" as const, parentId: "client-1" }

// Every row's download and remove control is an `IconButton`, which is a Radix tooltip trigger; the
// app shell provides the provider these tests have to stand in for.
function renderPanel(props: {
  attachments: AttachmentListItem[]
  canWrite: boolean
}): ReturnType<typeof render> {
  return render(
    <TooltipProvider>
      <AttachmentsPanel
        parent={PARENT}
        attachments={props.attachments}
        locale="en"
        canWrite={props.canWrite}
      />
    </TooltipProvider>
  )
}

function makeAttachment(overrides: Partial<AttachmentListItem> = {}): AttachmentListItem {
  return {
    id: "attachment-1",
    filename: "brief.pdf",
    title: null,
    mimeType: "application/pdf",
    sizeBytes: 2_048,
    createdAt: new Date("2026-05-30T12:00:00.000Z"),
    uploadedByName: "Owner",
    ...overrides
  }
}

afterEach(cleanup)

describe("AttachmentsPanel", () => {
  test("has no accessibility violations while listing files", async () => {
    const { container } = renderPanel({ attachments: [makeAttachment()], canWrite: true })

    expect((await axe(container)).violations).toEqual([])
  })

  test("has no accessibility violations in the empty state", async () => {
    const { container } = renderPanel({ attachments: [], canWrite: true })

    expect((await axe(container)).violations).toEqual([])
  })

  test("teaches what the panel is for when the record carries no files", () => {
    renderPanel({ attachments: [], canWrite: true })

    expect(screen.getByText("attachments.empty.title")).toBeInTheDocument()
  })

  test("links each file to the credentialed download route", () => {
    renderPanel({ attachments: [makeAttachment()], canWrite: true })

    expect(screen.getByRole("link", { name: "attachments.download" })).toHaveAttribute(
      "href",
      "/api/attachments/attachment-1"
    )
  })

  test("offers no drop target and no removal to a reader who may not write", () => {
    renderPanel({ attachments: [makeAttachment()], canWrite: false })

    expect(screen.queryByLabelText("attachments.label")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "attachments.remove" })).not.toBeInTheDocument()
  })

  test("asks for confirmation before removing a file", async () => {
    const user = userEvent.setup()

    renderPanel({ attachments: [makeAttachment()], canWrite: true })

    await user.click(screen.getByRole("button", { name: "attachments.remove" }))

    expect(screen.getByRole("dialog")).toHaveTextContent("attachments.removeConfirmTitle")
  })
})
