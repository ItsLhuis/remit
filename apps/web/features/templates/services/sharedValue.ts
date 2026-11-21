import { type BlockType } from "../schemas"

import { BLOCK_PROPERTY_GROUPS, type PropertyGroupKey } from "./blocks"

// The properties panel's multi-selection field helpers: every selected block's value for one
// field collapses to the value itself when they all agree, or to "mixed" otherwise, so a field
// row can render the shared value or the Mixed placeholder without the caller writing the
// comparison itself.

export type SharedFieldValue<T> = { kind: "uniform"; value: T } | { kind: "mixed" }

export function sharedValue<T>(values: readonly T[]): SharedFieldValue<T> {
  if (values.length === 0) return { kind: "mixed" }

  const [first, ...rest] = values

  return rest.every((value) => value === first)
    ? { kind: "uniform", value: first }
    : { kind: "mixed" }
}

// The property groups common to every type in the set: the multi-selection panel's style sections
// render only where every selected block's own capability agrees, so a mixed-type selection never
// shows a field a member type cannot actually persist.
export function intersectPropertyGroups(types: readonly BlockType[]): readonly PropertyGroupKey[] {
  return (
    types.reduce<readonly PropertyGroupKey[] | null>((common, type) => {
      const groups: readonly PropertyGroupKey[] = BLOCK_PROPERTY_GROUPS[type]

      return common === null ? groups : common.filter((group) => groups.includes(group))
    }, null) ?? []
  )
}
