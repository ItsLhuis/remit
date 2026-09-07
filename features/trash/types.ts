import { type TrashEntityKind } from "./schemas"
import { type RetentionPolicy } from "./services"

export type TrashItem = {
  kind: TrashEntityKind
  id: string
  title: string
  // What the row was attached to when it was deleted — a client name, an invoice number — so two
  // rows with the same title are still tellable apart in one undifferentiated list.
  context: string | null
  deletedAt: Date
  purgeDueAt: Date | null
}

export type TrashSectionData = {
  items: TrashItem[]
  policy: RetentionPolicy
  locale: string
  timeZone: string
}
