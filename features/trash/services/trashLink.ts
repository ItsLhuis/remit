import { TRASH_URL_KEY_PREFIX, type TrashEntityKind } from "../schemas"

// The address of one deleted record's place in the trash, which `parseTrashListQuery` reads back. A
// link from elsewhere — the activity feed — goes through this, so the parameter names live in one
// feature.
export function buildTrashRecordHref(kind: TrashEntityKind, id: string): string {
  const params = new URLSearchParams({
    [`${TRASH_URL_KEY_PREFIX}kind`]: kind,
    [`${TRASH_URL_KEY_PREFIX}record`]: id
  })

  return `/settings/data?${params.toString()}#trash`
}
