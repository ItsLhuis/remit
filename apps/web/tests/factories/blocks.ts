import { faker } from "@faker-js/faker"

import { type Block, type BlockConstraints, type BlockLayout } from "@/features/templates"

// Pure canvas-block factories for unit tests. They live apart from templates.ts on purpose: that
// file's database imports validate environment variables at import time, which unit suites must
// never trigger. Defaults are grid-aligned and in bounds, so a test only states the fields its
// behavior depends on.
type CanvasBlockOverrides = {
  id?: string
  layout?: Partial<BlockLayout>
  hidden?: boolean
  locked?: boolean
  constraints?: BlockConstraints
}

// Rotation is not part of the shared overrides: a group never carries its own rotation (its layout
// is always re-derived from its children's union), so only the rotation-capable factories below
// accept it, matching how the schema itself scopes the field to blockBaseShape and not
// groupBaseShape.
type RotatableOverrides = CanvasBlockOverrides & { rotation?: number }

function baseBlockFields(overrides: CanvasBlockOverrides, defaultLayout: BlockLayout) {
  return {
    id: overrides.id ?? faker.string.uuid(),
    layout: { ...defaultLayout, ...overrides.layout },
    hidden: overrides.hidden ?? false,
    locked: overrides.locked ?? false,
    ...(overrides.constraints ? { constraints: overrides.constraints } : {})
  }
}

export function makeTextBlock(
  overrides: RotatableOverrides & { content?: { html: string } } = {}
): Block {
  const base = baseBlockFields(overrides, { x: 0, y: 0, width: 160, height: 96 })

  return {
    ...base,
    type: "text",
    ...(overrides.rotation !== undefined ? { rotation: overrides.rotation } : {}),
    content: overrides.content ?? { html: base.id }
  }
}

export function makeShapeBlock(overrides: RotatableOverrides = {}): Block {
  const base = baseBlockFields(overrides, { x: 0, y: 0, width: 160, height: 96 })

  return {
    ...base,
    type: "shape",
    ...(overrides.rotation !== undefined ? { rotation: overrides.rotation } : {}),
    content: { variant: "rectangle" }
  }
}

export function makeFrameBlock(
  overrides: RotatableOverrides & { clip?: boolean; children?: Block[] } = {}
): Block {
  const base = baseBlockFields(overrides, { x: 0, y: 0, width: 480, height: 240 })

  return {
    ...base,
    type: "frame",
    ...(overrides.rotation !== undefined ? { rotation: overrides.rotation } : {}),
    content: { clip: overrides.clip ?? false, children: overrides.children ?? [] }
  }
}

// A group's own layout is normally re-derived as the union of its children (services/groupBounds
// .ts's normalizeGroups); tests that build a group directly supply a layout consistent with its
// children, or run the fixture through normalizeGroups first.
export function makeGroupBlock(overrides: CanvasBlockOverrides & { children: Block[] }): Block {
  const base = baseBlockFields(overrides, { x: 0, y: 0, width: 480, height: 240 })

  return { ...base, type: "group", content: { children: overrides.children } }
}
