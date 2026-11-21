import { z } from "zod"

import {
  blockConstraintsSchema,
  blockIdSchema,
  blockStyleSchema,
  rotationSchema,
  shapeContentSchema,
  spacerContentSchema,
  tableColumnSchema,
  tableRowSchema,
  textContentSchema
} from "./schemas"

// Stored rows may predate the free-canvas model in three generations: the list model (no layout),
// the freeform-canvas model (per-block frame, no layout), and the document-flow model ((row,
// column) layouts, structured domain types, the heading primitive). Reads parse with this tolerant
// schema and normalize through normalizeBlocks; strict blocksSchema stays the only write shape.
const legacyFrameSchema = z.object({
  x: z.number().int().min(0).max(4000),
  y: z.number().int().min(0).max(4000),
  width: z.number().int().min(16).max(2000),
  height: z.number().int().min(16).max(2000)
})

const storedLayoutSchema = z.object({
  slot: z.enum(["header", "body", "footer"]).optional(),
  row: z.number().optional(),
  column: z.number().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().nullable().optional(),
  height: z.number().nullable().optional()
})

const storedImageContentSchema = z.object({
  source: z.enum(["upload", "businessLogo"]).optional(),
  uploadId: z.uuid().nullable().optional(),
  alt: z.string().optional()
})

const storedBlockBaseShape = {
  id: blockIdSchema,
  name: z.string().optional(),
  layout: storedLayoutSchema.optional(),
  rotation: rotationSchema.optional(),
  hidden: z.boolean().optional(),
  locked: z.boolean().optional(),
  constraints: blockConstraintsSchema.optional(),
  style: blockStyleSchema.optional(),
  frame: legacyFrameSchema.optional()
}

// Only the user-authored string survives the migration; presentation toggles are dropped.
const storedHeadingContentSchema = z.object({
  text: z.string(),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)])
})

const storedTitleContentSchema = z.object({ title: z.string().optional() })
const storedTextContentSchema = z.object({ text: z.string().optional() })

const storedTableContentSchema = z.object({
  source: z.enum(["manual", "lineItems"]),
  columns: z.array(tableColumnSchema),
  rows: z.array(tableRowSchema)
})

const storedBoxContentSchema = z.object({
  direction: z.enum(["row", "column"]),
  justify: z.enum(["start", "center", "end", "space-between"]),
  align: z.enum(["start", "center", "end"]),
  gap: z.number(),
  children: z.array(z.unknown())
})

const storedFrameContentSchema = z.object({
  clip: z.boolean().optional(),
  children: z.array(z.unknown())
})

const storedGroupContentSchema = z.object({
  children: z.array(z.unknown())
})

export const storedBlockSchema = z.discriminatedUnion("type", [
  z.object({
    ...storedBlockBaseShape,
    type: z.literal("heading"),
    content: storedHeadingContentSchema
  }),
  z.object({ ...storedBlockBaseShape, type: z.literal("text"), content: textContentSchema }),
  z.object({
    ...storedBlockBaseShape,
    type: z.literal("image"),
    content: storedImageContentSchema
  }),
  z.object({ ...storedBlockBaseShape, type: z.literal("divider"), content: z.object({}) }),
  z.object({ ...storedBlockBaseShape, type: z.literal("spacer"), content: spacerContentSchema }),
  z.object({ ...storedBlockBaseShape, type: z.literal("shape"), content: shapeContentSchema }),
  z.object({
    ...storedBlockBaseShape,
    type: z.literal("table"),
    content: storedTableContentSchema
  }),
  z.object({ ...storedBlockBaseShape, type: z.literal("box"), content: storedBoxContentSchema }),
  z.object({
    ...storedBlockBaseShape,
    type: z.literal("frame"),
    content: storedFrameContentSchema
  }),
  z.object({
    ...storedBlockBaseShape,
    type: z.literal("group"),
    content: storedGroupContentSchema
  }),
  z.object({
    ...storedBlockBaseShape,
    type: z.literal("header"),
    content: storedTitleContentSchema
  }),
  z.object({
    ...storedBlockBaseShape,
    type: z.literal("footer"),
    content: storedTextContentSchema
  }),
  z.object({ ...storedBlockBaseShape, type: z.literal("business_info"), content: z.unknown() }),
  z.object({ ...storedBlockBaseShape, type: z.literal("client_info"), content: z.unknown() }),
  z.object({ ...storedBlockBaseShape, type: z.literal("line_items"), content: z.unknown() }),
  z.object({ ...storedBlockBaseShape, type: z.literal("totals"), content: z.unknown() }),
  z.object({ ...storedBlockBaseShape, type: z.literal("payment_info"), content: z.unknown() }),
  z.object({ ...storedBlockBaseShape, type: z.literal("notes"), content: storedTextContentSchema }),
  z.object({ ...storedBlockBaseShape, type: z.literal("terms"), content: storedTextContentSchema }),
  z.object({ ...storedBlockBaseShape, type: z.literal("signature"), content: z.unknown() })
])

export type StoredBlock = z.infer<typeof storedBlockSchema>

export const storedBlocksSchema = z.array(storedBlockSchema)
