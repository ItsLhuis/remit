import { storedBlocksSchema, storedPageSettingsSchema } from "../schemas"
import { type TemplateType } from "../schemas"
import { type TemplateEditorData } from "../types"

import { normalizePageSettings } from "./canvasLayout"
import { normalizeBlocks } from "./normalizeBlocks"

// Turns a stored template row into the normalized shape every consumer works with. It is pure, so it
// lives here rather than in `queries.ts` where it started — and that move is load-bearing rather
// than tidy. Two features need it: the editor reaches it through `queries.ts`, and
// `features/email/documentEmail.ts` renders a message body from the same blocks. Reaching it through
// the templates server barrel pulled that barrel's mutations and components behind it, and those
// reach `lib/auth`, which sends mail — a cycle back into `features/email`.
//
// The parameter is typed structurally rather than as `templates.$inferSelect`, because a service may
// not import the ORM at all (`architecture.md`, purity rule) — and it should not: what this needs is
// the shape, not the table.
//
// A row whose stored JSON no longer parses degrades to an empty canvas instead of throwing: the
// block schema evolves, and a template saved by an older version must still open rather than break
// the page it is rendered on.
export type StoredTemplateRow = {
  id: string
  name: string
  type: TemplateType
  subject: string | null
  blocks: unknown
  pageSettings: unknown
  isDefault: boolean
  isSystem: boolean
}

export function toTemplateEditorData(row: StoredTemplateRow): TemplateEditorData {
  const parsed = storedBlocksSchema.safeParse(row.blocks)
  const parsedPageSettings = storedPageSettingsSchema.safeParse(row.pageSettings)

  const pageSettings = normalizePageSettings(
    parsedPageSettings.success ? parsedPageSettings.data : null
  )

  return {
    id: row.id,
    name: row.name,
    type: row.type,
    subject: row.subject ?? "",
    blocks: parsed.success ? normalizeBlocks(parsed.data, row.type, pageSettings) : [],
    pageSettings,
    assets: {},
    isDefault: row.isDefault,
    isSystem: row.isSystem
  }
}
