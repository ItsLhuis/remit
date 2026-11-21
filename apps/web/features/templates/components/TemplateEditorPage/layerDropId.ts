// The dnd-kit id vocabulary the layers tree speaks: LayerRow registers these ids and LayersList
// decodes them. It lives outside both components so neither module mixes a component export with
// the shared contract between them.

const INTO_PREFIX = "into:"

export const PAGE_GROUP = "__page__"

export function intoDropId(frameId: string): string {
  return `${INTO_PREFIX}${frameId}`
}

export function parseIntoDropId(dropId: string): string | null {
  return dropId.startsWith(INTO_PREFIX) ? dropId.slice(INTO_PREFIX.length) : null
}
