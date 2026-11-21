import {
  type Block,
  type TemplateListQuery,
  type TemplatePageSettings,
  type TemplateType
} from "./schemas"
import { type TemplatesSummary } from "./services"

// The renderer's real HTML for the template at its real output size, computed on the server so the
// listing can show the document itself instead of an approximation. Null when the template has no
// blocks yet and there is nothing to draw.
export type TemplateThumbnail = {
  html: string
  width: number
  height: number
}

export type TemplateListItem = {
  id: string
  name: string
  type: TemplateType
  subject: string | null
  isDefault: boolean
  isSystem: boolean
  updatedAt: Date
  thumbnail: TemplateThumbnail | null
}

export type TemplateDefaults = {
  defaultLocale: string
}

export type TemplateListPageData = {
  templates: TemplateListItem[]
  rowCount: number
  summary: TemplatesSummary
  query: TemplateListQuery
  defaults: TemplateDefaults
}

export type TemplateEditorData = {
  id: string
  name: string
  type: TemplateType
  subject: string
  blocks: Block[]
  pageSettings: TemplatePageSettings
  assets: Record<string, string>
  isDefault: boolean
  isSystem: boolean
}
