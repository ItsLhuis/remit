import { type TrashEntityKind } from "./schemas"
import { type PurgeSchedule, type RetentionPolicy } from "./services"

export type TrashItem = {
  kind: TrashEntityKind
  id: string
  title: string
  // What the row was attached to when it was deleted — a client name, an invoice number — so two
  // rows with the same title are still tellable apart in one undifferentiated list.
  context: string | null
  deletedAt: Date
  purge: PurgeSchedule
}

export type TrashSectionData = {
  items: TrashItem[]
  rowCount: number
  // True when an activity-feed link narrowed the trash to one record, so the surface can offer the
  // way back to the whole list.
  isNarrowedToRecord: boolean
  policy: RetentionPolicy
  locale: string
  timeZone: string
}
