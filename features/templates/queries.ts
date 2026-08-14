import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  type AnyColumn,
  type SQL
} from "drizzle-orm"

import { database } from "@/database"
import { templates, uploads } from "@/database/schema"

import {
  parseTemplateListQuery,
  templateIdSchema,
  type Block,
  type TemplateListQuery,
  type TemplateSortField
} from "./schemas"
import {
  buildSampleRenderData,
  toTemplateEditorData,
  flattenBlocks,
  getPageHeight,
  getPageWidth,
  renderTemplate,
  summarizeTemplates,
  BUSINESS_LOGO_ASSET_KEY,
  type TemplatesSummary
} from "./services"
import {
  type TemplateDefaults,
  type TemplateEditorData,
  type TemplateListItem,
  type TemplateListPageData,
  type TemplateThumbnail
} from "./types"

export async function getTemplatesPageData(input: unknown): Promise<TemplateListPageData> {
  const query = parseTemplateListQuery(input)

  const [list, summary, defaults] = await Promise.all([
    listTemplates(query),
    getTemplatesSummary(),
    getTemplateDefaults()
  ])

  return {
    templates: list.rows,
    rowCount: list.rowCount,
    summary,
    query,
    defaults
  }
}

export async function getTemplatesSummary(): Promise<TemplatesSummary> {
  const rows = await database
    .select({
      type: templates.type,
      isSystem: templates.isSystem,
      isDefault: templates.isDefault
    })
    .from(templates)
    .where(isNull(templates.deletedAt))

  return summarizeTemplates(rows)
}

export async function listTemplates(
  query: TemplateListQuery
): Promise<{ rows: TemplateListItem[]; rowCount: number }> {
  const whereClause = getTemplateListWhereClause(query)

  const [rows, totalRows] = await Promise.all([
    database.query.templates.findMany({
      where: whereClause,
      orderBy: getTemplateListOrderBy(query),
      limit: query.perPage,
      offset: (query.page - 1) * query.perPage
    }),
    database.select({ value: count() }).from(templates).where(whereClause)
  ])

  const items = rows.map((row) => ({ row, editorData: toTemplateEditorData(row) }))

  // One asset lookup for the whole page: the map is keyed by upload id, so every thumbnail on the
  // page renders from the same resolved paths instead of querying per template.
  const assets = await resolveTemplateAssets(items.flatMap((item) => item.editorData.blocks))

  return {
    rows: items.map((item) => toTemplateListItem(item.row, item.editorData, assets)),
    rowCount: totalRows[0]?.value ?? 0
  }
}

export async function getTemplateForEdit(input: unknown): Promise<TemplateEditorData | null> {
  const parsed = templateIdSchema.safeParse(input)

  if (!parsed.success) return null

  const row = await database.query.templates.findFirst({
    where: and(eq(templates.id, parsed.data.id), isNull(templates.deletedAt))
  })

  if (!row) return null

  const editorData = toTemplateEditorData(row)

  return { ...editorData, assets: await resolveTemplateAssets(editorData.blocks) }
}

// Maps each referenced upload id to its storage path so image blocks (frame children included, to
// any depth) resolve to servable URLs at preview/render time; the block itself never stores a URL.
// The business logo resolves from settings.businessLogoUploadId under its reserved assets key.
export async function resolveTemplateAssets(blocks: Block[]): Promise<Record<string, string>> {
  const uploadIds = flattenBlocks(blocks)
    .map((block) => (block.type === "image" ? block.content.uploadId : null))
    .filter((uploadId): uploadId is string => uploadId !== null)

  const settingsRow = await database.query.settings.findFirst({
    columns: { businessLogoUploadId: true }
  })

  const logoUploadId = settingsRow?.businessLogoUploadId ?? null

  const lookupIds = [...new Set([...uploadIds, ...(logoUploadId ? [logoUploadId] : [])])]

  if (lookupIds.length === 0) return {}

  const rows = await database
    .select({ id: uploads.id, path: uploads.path })
    .from(uploads)
    .where(inArray(uploads.id, lookupIds))

  const assets = Object.fromEntries(rows.map((row) => [row.id, row.path]))
  const logoPath = logoUploadId ? assets[logoUploadId] : undefined

  return logoPath ? { ...assets, [BUSINESS_LOGO_ASSET_KEY]: logoPath } : assets
}

async function getTemplateDefaults(): Promise<TemplateDefaults> {
  const row = await database.query.settings.findFirst({
    columns: { defaultLocale: true }
  })

  return { defaultLocale: row?.defaultLocale ?? "en" }
}

function getTemplateListWhereClause(query: TemplateListQuery): SQL | undefined {
  const conditions: SQL[] = [isNull(templates.deletedAt)]

  if (query.search) {
    const searchPattern = `%${query.search}%`
    const searchCondition = or(
      ilike(templates.name, searchPattern),
      ilike(templates.subject, searchPattern)
    )

    if (searchCondition) conditions.push(searchCondition)
  }

  if (query.types.length > 0) conditions.push(inArray(templates.type, query.types))

  if (query.origin === "system") conditions.push(eq(templates.isSystem, true))
  if (query.origin === "custom") conditions.push(eq(templates.isSystem, false))

  return and(...conditions)
}

function getTemplateListOrderBy(query: TemplateListQuery): SQL[] {
  const sortColumns: Record<TemplateSortField, AnyColumn> = {
    name: templates.name,
    type: templates.type,
    updated: templates.updatedAt
  }

  // Name then id break ties, so a template with a shared sort key never jumps between pages.
  return [
    ...query.sort.map((item) =>
      item.desc ? desc(sortColumns[item.id]) : asc(sortColumns[item.id])
    ),
    asc(templates.name),
    asc(templates.id)
  ]
}

function toTemplateListItem(
  row: typeof templates.$inferSelect,
  editorData: TemplateEditorData,
  assets: Record<string, string>
): TemplateListItem {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    subject: row.subject,
    isDefault: row.isDefault,
    isSystem: row.isSystem,
    updatedAt: row.updatedAt,
    thumbnail: toTemplateThumbnail(editorData, assets)
  }
}

function toTemplateThumbnail(
  editorData: TemplateEditorData,
  assets: Record<string, string>
): TemplateThumbnail | null {
  const { blocks, type, pageSettings } = editorData

  if (blocks.length === 0) return null

  return {
    html: renderTemplate({
      blocks,
      renderData: buildSampleRenderData(type),
      type,
      format: "html",
      pageSettings,
      assets
    }),
    width: getPageWidth(type),
    height: getPageHeight(blocks, type, pageSettings)
  }
}
