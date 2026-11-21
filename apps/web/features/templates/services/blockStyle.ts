import { type BlockStyle } from "../schemas"

// Optional style properties reset by deletion, never by storing a sentinel: a patch value of
// undefined removes the key, and an empty style object collapses to undefined so untouched blocks
// persist without a style field at all.
export function patchBlockStyle(
  style: BlockStyle | undefined,
  patch: Partial<BlockStyle>
): BlockStyle | undefined {
  const next: BlockStyle = { ...style }

  for (const key of Object.keys(patch) as (keyof BlockStyle)[]) {
    const value = patch[key]

    if (value === undefined) {
      delete next[key]
    } else {
      Object.assign(next, { [key]: value })
    }
  }

  return Object.keys(next).length > 0 ? next : undefined
}
