import { type AttachmentParent } from "../schemas"

export type AttachmentParentColumns = {
  clientId: string | null
  projectId: string | null
  invoiceId: string | null
  expenseId: string | null
}

// The one mapping between the wire's `(parentType, parentId)` pair and the four nullable columns
// `chk_attachments_parent` constrains. Every write goes through it, so "exactly one parent column is
// set" holds in TypeScript before Postgres has to enforce it, and a fifth attachable entity fails to
// compile here rather than failing the check constraint at runtime.
export function toAttachmentParentColumns(parent: AttachmentParent): AttachmentParentColumns {
  const empty: AttachmentParentColumns = {
    clientId: null,
    projectId: null,
    invoiceId: null,
    expenseId: null
  }

  switch (parent.parentType) {
    case "client":
      return { ...empty, clientId: parent.parentId }
    case "project":
      return { ...empty, projectId: parent.parentId }
    case "invoice":
      return { ...empty, invoiceId: parent.parentId }
    case "expense":
      return { ...empty, expenseId: parent.parentId }
  }
}

export function toAttachmentParent(columns: AttachmentParentColumns): AttachmentParent | null {
  if (columns.clientId) return { parentType: "client", parentId: columns.clientId }
  if (columns.projectId) return { parentType: "project", parentId: columns.projectId }
  if (columns.invoiceId) return { parentType: "invoice", parentId: columns.invoiceId }
  if (columns.expenseId) return { parentType: "expense", parentId: columns.expenseId }

  return null
}
