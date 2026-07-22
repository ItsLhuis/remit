import { type Block, type FrameBlock, type GroupBlock } from "../schemas"

export type ContainerBlock = FrameBlock | GroupBlock

export type BlockLookup = {
  block: Block
  parent: ContainerBlock | null
}

// Selection addresses top-level blocks and container (frame or group) children, nested to
// FRAME_MAX_DEPTH, by one id; every lookup and replacement is nesting-aware and reports the
// nearest container ancestor as the parent.
export function findBlock(blocks: readonly Block[], id: string | null): BlockLookup | null {
  if (!id) return null

  for (const block of blocks) {
    if (block.id === id) return { block, parent: null }

    if (block.type !== "frame" && block.type !== "group") continue

    const nested = findInContainer(block, id)

    if (nested) return nested
  }

  return null
}

export function replaceById(blocks: readonly Block[], next: Block): Block[] {
  return blocks.map((block) => {
    if (block.id === next.id) return next

    if (block.type !== "frame" && block.type !== "group") return block

    return {
      ...block,
      content: { ...block.content, children: replaceById(block.content.children, next) }
    } as Block
  })
}

// Splices zero or more replacement blocks in place of one block, anywhere in the tree - the
// ungroup primitive: a group's freed children replace it in situ, at whatever depth it lived.
export function spliceById(
  blocks: readonly Block[],
  id: string,
  replacement: readonly Block[]
): Block[] {
  return blocks.flatMap((block) => {
    if (block.id === id) return [...replacement]

    if (block.type !== "frame" && block.type !== "group") return [block]

    const children = spliceById(block.content.children, id, replacement)

    if (children === block.content.children) return [block]

    return [{ ...block, content: { ...block.content, children } } as Block]
  })
}

export function removeById(blocks: readonly Block[], id: string): Block[] {
  return blocks
    .filter((block) => block.id !== id)
    .map((block) =>
      block.type === "frame" || block.type === "group"
        ? ({
            ...block,
            content: { ...block.content, children: removeById(block.content.children, id) }
          } as Block)
        : block
    )
}

export type SiblingStep = "forward" | "backward"
export type SiblingEdge = "front" | "back"

// Z-order is sibling array order at whatever depth a block lives, not only the top level: this
// moves one block within its own parent's children (the top-level array for a parentless block, a
// frame's content.children otherwise). Null means the move is illegal or a no-op (unknown id,
// already at the requested edge) so no meaningless undo entry is pushed.
export function moveSiblingOrder(
  blocks: readonly Block[],
  id: string,
  direction: SiblingStep | SiblingEdge
): Block[] | null {
  const lookup = findBlock(blocks, id)

  if (!lookup) return null

  const siblings = lookup.parent === null ? blocks : lookup.parent.content.children
  const index = siblings.findIndex((block) => block.id === id)

  if (index < 0) return null

  const target =
    direction === "forward"
      ? index + 1
      : direction === "backward"
        ? index - 1
        : direction === "front"
          ? siblings.length - 1
          : 0

  if (target === index || target < 0 || target >= siblings.length) return null

  const next = [...siblings]
  const [moved] = next.splice(index, 1)

  if (!moved) return null

  next.splice(target, 0, moved)

  return applySiblingOrder(blocks, lookup.parent, next)
}

// The multi-member counterpart of moveSiblingOrder, front/back only: the whole selection moves to
// the array edge as one unit, keeping its own members' relative order. Null when the selection is
// empty, spans more than one parent, or resolves an unknown id.
export function moveSiblingGroupToEdge(
  blocks: readonly Block[],
  ids: readonly string[],
  edge: SiblingEdge
): Block[] | null {
  if (ids.length === 0) return null

  const lookups = ids.map((id) => findBlock(blocks, id))

  if (lookups.some((lookup) => lookup === null)) return null

  const parentIds = new Set(lookups.map((lookup) => lookup?.parent?.id ?? null))

  if (parentIds.size > 1) return null

  const parent = lookups[0]?.parent ?? null
  const siblings = parent === null ? blocks : parent.content.children
  const idSet = new Set(ids)
  const moving = siblings.filter((block) => idSet.has(block.id))
  const staying = siblings.filter((block) => !idSet.has(block.id))

  if (moving.length !== ids.length) return null

  const next = edge === "front" ? [...staying, ...moving] : [...moving, ...staying]

  return applySiblingOrder(blocks, parent, next)
}

// A group carries no style property at all, so there is nothing to strip from one.
export function stripStyle(block: Block): Block {
  if (block.type === "group") return block

  const rest = { ...block }

  delete rest.style

  return rest
}

export function stripName(block: Block): Block {
  const rest = { ...block }

  delete rest.name

  return rest
}

function findInContainer(container: ContainerBlock, id: string): BlockLookup | null {
  for (const child of container.content.children) {
    if (child.id === id) return { block: child, parent: container }

    if (child.type === "frame" || child.type === "group") {
      const nested = findInContainer(child, id)

      if (nested) return nested
    }
  }

  return null
}

// Writes a reordered sibling array back into the tree: the top-level array itself for a parentless
// block, or the owning container's children otherwise.
function applySiblingOrder(
  blocks: readonly Block[],
  parent: ContainerBlock | null,
  next: Block[]
): Block[] {
  if (parent === null) return next

  return replaceById(blocks, { ...parent, content: { ...parent.content, children: next } } as Block)
}
