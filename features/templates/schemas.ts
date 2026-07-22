import { z } from "zod"

import i18n from "@/lib/i18n/i18n"

import {
  readArrayParam,
  readIntParam,
  readSortParam,
  readStringParam,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE
} from "@/lib/utils"

import { type templates } from "@/database/schema"

export type TemplateType = (typeof templates.$inferSelect)["type"]

const TEMPLATE_NAME_MAX_LENGTH = 160
const TEMPLATE_SUBJECT_MAX_LENGTH = 300
export const TEXT_HTML_MAX_LENGTH = 20000
const IMAGE_ALT_MAX_LENGTH = 300
const TABLE_HEADER_MAX_LENGTH = 200
const TABLE_CELL_MAX_LENGTH = 2000
const TABLE_MAX_COLUMNS = 8
const TABLE_MAX_ROWS = 50
export const FRAME_MAX_CHILDREN = 8
export const FRAME_MAX_DEPTH = 2

// The page grid: every stored coordinate, width, height, padding, and margin is a whole number of
// grid cells.
export const GRID_SIZE = 8

export const PAGE_MARGIN_MAX = 96
export const CANVAS_MAX_HEIGHT = 4000
export const MIN_BLOCK_WIDTH = 48
export const MIN_BLOCK_HEIGHT = 16
const BLOCK_WIDTH_MAX = 794

export const TEMPLATE_TYPES = [
  "invoice",
  "proposal",
  "contract",
  "credit_note",
  "email_invoice_send",
  "email_proposal_send",
  "email_contract_send",
  "email_payment_receipt",
  "email_overdue_reminder",
  "email_recurring_generated"
] as const satisfies readonly TemplateType[]

export const BLOCK_TYPES = ["text", "image", "table", "frame", "group", "shape"] as const

// The block types the "add empty block" palette offers: every persisted type except group, which
// has no independently authored content and can only be created by grouping an existing selection.
export type AddableBlockType = Exclude<(typeof BLOCK_TYPES)[number], "group">

// The block types the add-child palette offers inside a frame: leaves plus a nested frame, bounded
// to FRAME_MAX_DEPTH container levels by a depth walk on the write path. The write union admits any
// block as a frame child (reparent can drag any block in); this is only the click-to-add subset.
export const FRAME_CHILD_TYPES = ["text", "image", "shape", "frame"] as const

export const TEMPLATE_FONT_KEYS = ["sans", "serif", "mono"] as const

export type TemplateFontKey = (typeof TEMPLATE_FONT_KEYS)[number]

type EnsureAllTemplateTypes =
  Exclude<TemplateType, (typeof TEMPLATE_TYPES)[number]> extends never ? true : never

const _templateTypesAreExhaustive: EnsureAllTemplateTypes = true

void _templateTypesAreExhaustive

export const templateTypeSchema = z.enum(TEMPLATE_TYPES)

export type BlockResizableAxes = "none" | "width" | "height" | "both"

export type BlockCapability = {
  resizableAxes: BlockResizableAxes
}

export const BLOCK_CAPABILITIES = {
  text: { resizableAxes: "both" },
  image: { resizableAxes: "both" },
  table: { resizableAxes: "both" },
  frame: { resizableAxes: "both" },
  // A group is resizable, but resizing one always means scaling its members through the shared
  // set-scale primitive (services/resizeMath.ts) - a group never authors an independent size.
  group: { resizableAxes: "both" },
  shape: { resizableAxes: "both" }
} as const satisfies Record<(typeof BLOCK_TYPES)[number], BlockCapability>

const blockIdSchema = z.string().min(1)

const BLOCK_NAME_MAX_LENGTH = 120

const blockNameSchema = z
  .string()
  .trim()
  .max(
    BLOCK_NAME_MAX_LENGTH,
    i18n.t("templates.validation.blockNameTooLong", { count: BLOCK_NAME_MAX_LENGTH })
  )
  .optional()

export const renameBlockSchema = z.object({ name: blockNameSchema })

export type RenameBlockValues = z.infer<typeof renameBlockSchema>

// Position (x/y) is a whole page pixel, not constrained to the grid: dragging with Alt held places
// a block off-grid (grid snapping is the default the editor applies, not a persistence rule). A
// top-level block's position below 0 is rejected at save time by validateLayout
// (services/canvasLayout.ts, which needs the template type and margins this schema cannot see) -
// every interactive path (drag, resize, rotate, nudge, panel field, paste) clamps a top-level block
// into the page bounds before it ever commits, so validateLayout's reject is a backstop against
// malformed data, not a normal-path outcome; a container child's position may be negative (it has
// dragged partially outside its frame or group, which clips or shows the overflow), so the schema
// floor stays symmetric rather than per-position-in-tree.
const coordinateSchema = z
  .number()
  .int(i18n.t("templates.validation.layoutInvalid"))
  .min(-CANVAS_MAX_HEIGHT, i18n.t("templates.validation.layoutInvalid"))
  .max(CANVAS_MAX_HEIGHT, i18n.t("templates.validation.layoutInvalid"))

// Width/height are whole pixels with no grid-multiple constraint: proportional set scaling (group
// and multi-selection resize) cannot preserve both member proportions and grid-multiple
// sizes, so grid alignment is the editor's default snap behavior, not a storage invariant. Single-
// block handle resize still snaps to the grid by default; clampRectToBounds and the normalizeBlocks
// migrators keep quantizing on their own paths regardless of what this schema accepts.
const blockWidthSchema = z
  .number()
  .int(i18n.t("templates.validation.sizeInvalid"))
  .min(MIN_BLOCK_WIDTH, i18n.t("templates.validation.sizeInvalid"))
  .max(BLOCK_WIDTH_MAX, i18n.t("templates.validation.sizeInvalid"))

const blockHeightSchema = z
  .number()
  .int(i18n.t("templates.validation.sizeInvalid"))
  .min(MIN_BLOCK_HEIGHT, i18n.t("templates.validation.sizeInvalid"))
  .max(CANVAS_MAX_HEIGHT, i18n.t("templates.validation.sizeInvalid"))

// A table column's width stays grid-aligned: columns are never scaled through the set-scale
// primitive, so the persistence relaxation above does not apply to them.
const tableColumnWidthSchema = z
  .number()
  .int(i18n.t("templates.validation.sizeInvalid"))
  .min(MIN_BLOCK_WIDTH, i18n.t("templates.validation.sizeInvalid"))
  .max(BLOCK_WIDTH_MAX, i18n.t("templates.validation.sizeInvalid"))
  .multipleOf(GRID_SIZE, i18n.t("templates.validation.sizeInvalid"))

// A block's position is an absolute rectangle inside the page's content box (page minus margins),
// in whole page pixels (grid-snapped by default, off-grid when placed with Alt). Overlap is legal
// (layered z-order); staying in-bounds is the one hard invariant, rejected on save by validateLayout
// in services/canvasLayout.ts (which needs the template type and margins this schema cannot see).
export const blockLayoutSchema = z.object({
  x: coordinateSchema,
  y: coordinateSchema,
  width: blockWidthSchema,
  height: blockHeightSchema
})

export type BlockLayout = z.infer<typeof blockLayoutSchema>

// A block's rotation about its own rect's center: finite degrees (z.number() rejects NaN/Infinity)
// normalized to [0, 360), the range services/geometry.ts's normalizeDegrees produces and the
// handle-cursor bucketing assumes. A sibling of layout, never folded into it, so every rect-only
// consumer keeps working in plain axis-aligned rects (matching BlockIndexEntry.rotation and
// ResizeSetMember.rotation). Optional like style/constraints: absent means 0, applied by readers.
// A group never rotates itself - groupBaseShape has no field for it; normalizeGroups always
// re-derives a group's box as the union of its children.
const rotationInvalidMessage = i18n.t("templates.validation.layoutInvalid")
const rotationSchema = z.number().min(0, rotationInvalidMessage).lt(360, rotationInvalidMessage)

const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, i18n.t("templates.validation.colorInvalid"))

const paddingSideSchema = z
  .number()
  .int(i18n.t("templates.validation.styleInvalid"))
  .min(0, i18n.t("templates.validation.styleInvalid"))
  .max(PAGE_MARGIN_MAX, i18n.t("templates.validation.styleInvalid"))
  .multipleOf(GRID_SIZE, i18n.t("templates.validation.styleInvalid"))

export const blockStyleSchema = z.object({
  padding: z
    .object({
      top: paddingSideSchema,
      right: paddingSideSchema,
      bottom: paddingSideSchema,
      left: paddingSideSchema
    })
    .optional(),
  backgroundColor: hexColorSchema.optional(),
  borderWidth: z
    .number()
    .int(i18n.t("templates.validation.styleInvalid"))
    .min(0, i18n.t("templates.validation.styleInvalid"))
    .max(8, i18n.t("templates.validation.styleInvalid"))
    .optional(),
  borderColor: hexColorSchema.optional(),
  borderRadius: z
    .number()
    .int(i18n.t("templates.validation.styleInvalid"))
    .min(0, i18n.t("templates.validation.styleInvalid"))
    .max(32, i18n.t("templates.validation.styleInvalid"))
    .optional(),
  fontFamily: z.enum(TEMPLATE_FONT_KEYS).optional(),
  fontSize: z
    .number()
    .int(i18n.t("templates.validation.styleInvalid"))
    .min(8, i18n.t("templates.validation.styleInvalid"))
    .max(64, i18n.t("templates.validation.styleInvalid"))
    .optional(),
  fontWeight: z.enum(["300", "400", "500", "600", "700"]).optional(),
  textColor: hexColorSchema.optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
  lineHeight: z
    .number()
    .min(1, i18n.t("templates.validation.styleInvalid"))
    .max(2.5, i18n.t("templates.validation.styleInvalid"))
    .optional()
})

export type BlockStyle = z.infer<typeof blockStyleSchema>

const textContentSchema = z.object({
  html: z.string().max(TEXT_HTML_MAX_LENGTH, {
    message: i18n.t("templates.validation.textTooLong", { count: TEXT_HTML_MAX_LENGTH })
  })
})

// Images resolve through the assets map only: an uploads-row id, or the business logo upload from
// settings. No URL is ever stored.
const imageContentSchema = z.object({
  source: z.enum(["upload", "businessLogo"]),
  uploadId: z.uuid(i18n.t("templates.validation.imageUploadInvalid")).nullable(),
  alt: z
    .string()
    .trim()
    .max(IMAGE_ALT_MAX_LENGTH, {
      message: i18n.t("templates.validation.imageAltTooLong", { count: IMAGE_ALT_MAX_LENGTH })
    })
})

const spacerContentSchema = z.object({
  size: z.enum(["sm", "md", "lg"])
})

const shapeContentSchema = z.object({
  variant: z.enum(["rectangle", "ellipse", "line"])
})

export type ShapeVariant = z.infer<typeof shapeContentSchema>["variant"]

export const LINE_ITEM_FIELDS = [
  "lineItem.description",
  "lineItem.unit",
  "lineItem.quantity",
  "lineItem.unitPrice",
  "lineItem.discount",
  "lineItem.taxPercentage",
  "lineItem.subtotal",
  "lineItem.taxAmount",
  "lineItem.total"
] as const

export type LineItemField = (typeof LINE_ITEM_FIELDS)[number]

const tableColumnSchema = z.object({
  id: blockIdSchema,
  header: z.string().max(TABLE_HEADER_MAX_LENGTH, {
    message: i18n.t("templates.validation.tableHeaderTooLong", { count: TABLE_HEADER_MAX_LENGTH })
  }),
  width: tableColumnWidthSchema.nullable(),
  binding: z.enum(LINE_ITEM_FIELDS).nullable()
})

export type TableColumn = z.infer<typeof tableColumnSchema>

const tableRowSchema = z.object({
  id: blockIdSchema,
  cells: z.array(
    z.string().max(TABLE_CELL_MAX_LENGTH, {
      message: i18n.t("templates.validation.tableCellTooLong", { count: TABLE_CELL_MAX_LENGTH })
    })
  )
})

export type TableRow = z.infer<typeof tableRowSchema>

// Manual tables are author-controlled grids (cells may hold scalar merge tokens); line-items
// tables bind every column to a lineItem.* field and their body rows populate from the document's
// real items at render time.
const tableContentSchema = z
  .object({
    source: z.enum(["manual", "lineItems"]),
    columns: z
      .array(tableColumnSchema)
      .min(1, i18n.t("templates.validation.tableInvalid"))
      .max(TABLE_MAX_COLUMNS, i18n.t("templates.validation.tableInvalid")),
    rows: z.array(tableRowSchema).max(TABLE_MAX_ROWS, i18n.t("templates.validation.tableInvalid"))
  })
  .superRefine((content, context) => {
    const invalid = (path: (string | number)[]) => {
      context.addIssue({
        code: "custom",
        message: i18n.t("templates.validation.tableInvalid"),
        path
      })
    }

    content.rows.forEach((row, index) => {
      if (row.cells.length !== content.columns.length) invalid(["rows", index])
    })

    content.columns.forEach((column, index) => {
      const bindingRequired = content.source === "lineItems"

      if (bindingRequired !== (column.binding !== null)) invalid(["columns", index])
    })
  })

// Per-child layout constraints: meaningful only for a frame's direct children (services/constraints
// .ts's applyFrameResize reads them when the frame resizes); absent on every other block, where it
// defaults to "start"/"start" (pin top-left, today's resize behavior).
export const blockConstraintsSchema = z.object({
  horizontal: z.enum(["start", "end", "center", "stretch", "scale"]),
  vertical: z.enum(["start", "end", "center", "stretch", "scale"])
})

export type BlockConstraints = z.infer<typeof blockConstraintsSchema>

const blockBaseShape = {
  id: blockIdSchema,
  name: blockNameSchema,
  layout: blockLayoutSchema,
  rotation: rotationSchema.optional(),
  hidden: z.boolean(),
  locked: z.boolean(),
  constraints: blockConstraintsSchema.optional(),
  style: blockStyleSchema.optional()
}

// A group carries no style and no independent size: its layout rectangle is always
// re-derived as the bounding union of its children (services/groupBounds.ts), never authored.
const groupBaseShape = {
  id: blockIdSchema,
  name: blockNameSchema,
  layout: blockLayoutSchema,
  hidden: z.boolean(),
  locked: z.boolean(),
  constraints: blockConstraintsSchema.optional()
}

const leafBlockSchemas = [
  z.object({ ...blockBaseShape, type: z.literal("text"), content: textContentSchema }),
  z.object({ ...blockBaseShape, type: z.literal("image"), content: imageContentSchema })
] as const

// A frame is a container of absolute-positioned children: each child keeps its own x/y (relative to
// the frame's content origin), width, and height, and its array index is its z-order. Children may
// be any block — including a nested frame — so a block dragged in keeps its type; nesting recurses
// through the getters below (Zod 4 recursive objects) and is bounded to FRAME_MAX_DEPTH container
// levels by the depth walk on blocksSchema, so unbounded recursion can never reach the write path.
const frameBlockSchema = z.object({
  ...blockBaseShape,
  type: z.literal("frame"),
  get content() {
    return frameContentSchema
  }
})

const frameContentSchema = z.object({
  clip: z.boolean(),
  get children() {
    return z
      .array(blockSchema)
      .max(FRAME_MAX_CHILDREN, i18n.t("templates.validation.layoutInvalid"))
  }
})

export type FrameContent = z.infer<typeof frameContentSchema>
export type FrameBlock = z.infer<typeof frameBlockSchema>

// A group is a purely logical container: no style, no clip, no independently authored size.
// Children keep their own x/y exactly like frame children (relative to the group's own origin);
// the group's own layout re-derives as their bounding union after every edit
// (services/groupBounds.ts's normalizeGroups), so it is never set by hand.
const groupBlockSchema = z.object({
  ...groupBaseShape,
  type: z.literal("group"),
  get content() {
    return groupContentSchema
  }
})

const groupContentSchema = z.object({
  get children() {
    return z
      .array(blockSchema)
      .min(1, i18n.t("templates.validation.layoutInvalid"))
      .max(FRAME_MAX_CHILDREN, i18n.t("templates.validation.layoutInvalid"))
  }
})

export type GroupContent = z.infer<typeof groupContentSchema>
export type GroupBlock = z.infer<typeof groupBlockSchema>

const blockMemberSchemas = [
  ...leafBlockSchemas,
  z.object({ ...blockBaseShape, type: z.literal("table"), content: tableContentSchema }),
  frameBlockSchema,
  groupBlockSchema,
  z.object({ ...blockBaseShape, type: z.literal("shape"), content: shapeContentSchema })
] as const

export const blockSchema = z.discriminatedUnion("type", [...blockMemberSchemas])

export type Block = z.infer<typeof blockSchema>
export type BlockType = Block["type"]

// The block variants that carry a style property: every type except group, which is styleless by
// design. The property panel's style sections (spacing/appearance/typography) accept only this
// narrower type, matching BLOCK_PROPERTY_GROUPS.group = [] (they are never rendered for a group).
export type StyledBlock = Exclude<Block, GroupBlock>

// A frame or group's children may include frames and groups, bounded to FRAME_MAX_DEPTH container
// levels — enforced here by an explicit depth walk so a pathologically deep payload is rejected
// before it can be persisted.
function containerContentDepth(content: FrameContent | GroupContent): number {
  return (
    1 +
    content.children.reduce(
      (deepest, child) =>
        Math.max(
          deepest,
          child.type === "frame" || child.type === "group"
            ? containerContentDepth(child.content)
            : 0
        ),
      0
    )
  )
}

export const blocksSchema = z.array(blockSchema).superRefine((blocks, context) => {
  blocks.forEach((block, index) => {
    if (
      (block.type === "frame" || block.type === "group") &&
      containerContentDepth(block.content) > FRAME_MAX_DEPTH
    ) {
      context.addIssue({
        code: "custom",
        message: i18n.t("templates.validation.layoutInvalid"),
        path: [index, "content", "children"]
      })
    }
  })
})

export type Blocks = z.infer<typeof blocksSchema>

// Stored rows may predate the free-canvas model in three generations: the original list model
// (frameless rows, no layout), the legacy freeform-canvas model (per-block frame, no layout), and
// the constrained document-flow model ((row, column) layouts, plus the structured domain types and
// the heading primitive that shipped within it). Reads parse with this tolerant schema and
// normalize through normalizeBlocks; the strict blocksSchema stays the only write-path shape.
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

// Structured members keep only the user-authored string the migration preserves; every other field
// (presentation toggles) is stripped by the object parse and dropped.
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

const marginSideSchema = z
  .number()
  .int(i18n.t("templates.validation.marginInvalid"))
  .min(0, i18n.t("templates.validation.marginInvalid"))
  .max(PAGE_MARGIN_MAX, i18n.t("templates.validation.marginInvalid"))
  .multipleOf(GRID_SIZE, i18n.t("templates.validation.marginInvalid"))

export const templatePageSettingsSchema = z.object({
  margins: z.object({
    top: marginSideSchema,
    right: marginSideSchema,
    bottom: marginSideSchema,
    left: marginSideSchema
  }),
  fontFamily: z.enum(TEMPLATE_FONT_KEYS),
  baseFontSize: z
    .number()
    .int(i18n.t("templates.validation.fontSizeInvalid"))
    .min(10, i18n.t("templates.validation.fontSizeInvalid"))
    .max(24, i18n.t("templates.validation.fontSizeInvalid"))
})

export type TemplatePageSettings = z.infer<typeof templatePageSettingsSchema>

// Stored page settings are untrusted jsonb; reads normalize through this partial parse plus
// normalizePageSettings so legacy '{}' rows resolve to defaults.
export const storedPageSettingsSchema = templatePageSettingsSchema.partial()

export type StoredPageSettings = z.infer<typeof storedPageSettingsSchema>

const nameSchema = z
  .string()
  .trim()
  .min(1, i18n.t("templates.validation.nameRequired"))
  .max(
    TEMPLATE_NAME_MAX_LENGTH,
    i18n.t("templates.validation.nameTooLong", { count: TEMPLATE_NAME_MAX_LENGTH })
  )

const subjectSchema = z
  .string()
  .trim()
  .max(
    TEMPLATE_SUBJECT_MAX_LENGTH,
    i18n.t("templates.validation.subjectTooLong", { count: TEMPLATE_SUBJECT_MAX_LENGTH })
  )

export const templateDetailsSchema = z.object({
  name: nameSchema,
  subject: subjectSchema
})

export type TemplateDetailsValues = z.infer<typeof templateDetailsSchema>

export const templateNameSchema = z.object({ name: nameSchema })

export type TemplateNameValues = z.infer<typeof templateNameSchema>

export const createTemplateSchema = templateDetailsSchema.extend({
  type: templateTypeSchema
})

export type CreateTemplateValues = z.infer<typeof createTemplateSchema>

export const updateTemplateSchema = templateDetailsSchema.extend({
  id: z.uuid(i18n.t("templates.validation.idInvalid")),
  blocks: blocksSchema,
  pageSettings: templatePageSettingsSchema
})

export type UpdateTemplateValues = z.infer<typeof updateTemplateSchema>

export const templateIdSchema = z.object({
  id: z.uuid(i18n.t("templates.validation.idInvalid"))
})

export type TemplateIdValues = z.infer<typeof templateIdSchema>

export const confirmTemplateImageUploadSchema = z.object({
  objectKey: z.string().trim().min(1, i18n.t("templates.validation.imageObjectKeyRequired")),
  filename: z.string().trim().min(1, i18n.t("templates.validation.imageFilenameRequired")),
  contentType: z.string().trim().min(1, i18n.t("templates.validation.imageContentTypeRequired")),
  sizeBytes: z
    .number()
    .int(i18n.t("templates.validation.imageSizeInvalid"))
    .positive(i18n.t("templates.validation.imageSizeInvalid"))
})

export const TEMPLATE_ORIGIN_FILTERS = ["all", "custom", "system"] as const
export const TEMPLATE_SORT_FIELDS = ["name", "type", "updated"] as const

export type TemplateOriginFilter = (typeof TEMPLATE_ORIGIN_FILTERS)[number]
export type TemplateSortField = (typeof TEMPLATE_SORT_FIELDS)[number]

const templateOriginFilterSchema = z.enum(TEMPLATE_ORIGIN_FILTERS).catch("all")

const templateSortItemSchema = z.object({
  id: z.enum(TEMPLATE_SORT_FIELDS),
  desc: z.boolean()
})

export const templateListQuerySchema = z.object({
  search: z.string().trim().default(""),
  origin: templateOriginFilterSchema.default("all"),
  types: z.array(templateTypeSchema).default([]),
  page: z.number().int().positive().catch(1),
  perPage: z.number().int().positive().max(MAX_PAGE_SIZE).catch(DEFAULT_PAGE_SIZE),
  sort: z.array(templateSortItemSchema).catch([{ id: "type", desc: false }])
})

export type TemplateListQuery = z.infer<typeof templateListQuerySchema>

export function parseTemplateListQuery(input: unknown): TemplateListQuery {
  return templateListQuerySchema.parse({
    search: readStringParam(input, "search"),
    origin: readStringParam(input, "origin") || "all",
    types: readArrayParam(input, "type").filter((value): value is TemplateType =>
      (TEMPLATE_TYPES as readonly string[]).includes(value)
    ),
    page: readIntParam(input, "page", 1),
    perPage: readIntParam(input, "perPage", DEFAULT_PAGE_SIZE),
    sort: readSortParam(input, [{ id: "type", desc: false }])
  })
}
