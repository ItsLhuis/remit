import { describe, expect, test } from "vitest"

import { ATTACHMENT_PARENT_TYPES, type AttachmentParent } from "../../schemas"
import { toAttachmentParent, toAttachmentParentColumns } from "../attachmentParent"

const PARENT_ID = "6f1b6b1e-3f5f-4c4a-9a4c-2f1f2c9a1b33"

describe("toAttachmentParentColumns", () => {
  // The database's `chk_attachments_parent` counts non-null parent columns and demands exactly one.
  // This asserts the mapper never hands it a row that check would reject, for every parent type the
  // union admits — so adding a fifth entity fails here rather than at the constraint.
  test.each(ATTACHMENT_PARENT_TYPES)("sets exactly one parent column for %s", (parentType) => {
    const columns = toAttachmentParentColumns({ parentType, parentId: PARENT_ID })

    const populated = Object.values(columns).filter((value) => value !== null)

    expect(populated).toEqual([PARENT_ID])
  })

  test("names the column matching the parent type", () => {
    const columns = toAttachmentParentColumns({ parentType: "invoice", parentId: PARENT_ID })

    expect(columns.invoiceId).toBe(PARENT_ID)
    expect(columns.clientId).toBeNull()
  })
})

describe("toAttachmentParent", () => {
  test.each(ATTACHMENT_PARENT_TYPES)(
    "round-trips a %s parent back out of its columns",
    (parentType) => {
      const parent: AttachmentParent = { parentType, parentId: PARENT_ID }

      expect(toAttachmentParent(toAttachmentParentColumns(parent))).toEqual(parent)
    }
  )

  test("returns null when no parent column is set", () => {
    const result = toAttachmentParent({
      clientId: null,
      projectId: null,
      invoiceId: null,
      expenseId: null
    })

    expect(result).toBeNull()
  })
})
