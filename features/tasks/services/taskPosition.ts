export const POSITION_STEP = 1000

export type TaskPositionUpdate = { id: string; position: number }

export function getInitialTaskPosition(existingPositions: number[]): number {
  if (existingPositions.length === 0) return POSITION_STEP

  return Math.max(...existingPositions) + POSITION_STEP
}

export function getPositionBetween(before: number | null, after: number | null): number | null {
  if (before === null && after === null) return POSITION_STEP

  if (before === null && after !== null) return after - POSITION_STEP

  if (before !== null && after === null) return before + POSITION_STEP

  if (before !== null && after !== null) {
    const midpoint = Math.floor((before + after) / 2)

    return midpoint > before && midpoint < after ? midpoint : null
  }

  return null
}

export function repackPositions(count: number): number[] {
  return Array.from({ length: count }, (_, index) => (index + 1) * POSITION_STEP)
}

export function planTaskReorder(
  ordered: TaskPositionUpdate[],
  movedId: string,
  toIndex: number
): TaskPositionUpdate[] {
  const moved = ordered.find((item) => item.id === movedId)

  if (!moved) return []

  const without = ordered.filter((item) => item.id !== movedId)
  const clampedIndex = Math.max(0, Math.min(toIndex, without.length))
  const next = [...without.slice(0, clampedIndex), moved, ...without.slice(clampedIndex)]

  const before = clampedIndex > 0 ? next[clampedIndex - 1].position : null
  const after = clampedIndex < next.length - 1 ? next[clampedIndex + 1].position : null

  const position = getPositionBetween(before, after)

  if (position !== null) return [{ id: movedId, position }]

  const repacked = repackPositions(next.length)

  return next.map((item, index) => ({ id: item.id, position: repacked[index] }))
}
