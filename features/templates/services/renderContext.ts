import { escapeHtml } from "@/lib/utils"

import { type TemplateType } from "../schemas"

import { getMergeVariables, type MergeVariableId, type TemplateRenderData } from "./mergeVariables"
import { getTemplateCategory, type TemplateCategory } from "./templateCategories"

// Shared resolution context for the renderer. Every scalar resolves through mergeValue - the
// allowed-set -> dictionary lookup -> escape path - so no identifier outside the per-type whitelist
// can surface and no value reaches the HTML format unescaped.

export type RenderFormat = "html" | "text"

export type RenderContext = {
  allowed: Set<string>
  data: TemplateRenderData
  format: RenderFormat
  assets: Record<string, string>
  category: TemplateCategory
}

export function createRenderContext(
  data: TemplateRenderData,
  type: TemplateType,
  format: RenderFormat,
  assets: Record<string, string>
): RenderContext {
  return {
    allowed: new Set(getMergeVariables(type)),
    data,
    format,
    assets,
    category: getTemplateCategory(type)
  }
}

export function mergeValue(context: RenderContext, id: MergeVariableId | undefined): string {
  if (!id || !context.allowed.has(id)) return ""

  const value = formatMergeValue(context.data.values[id])

  return context.format === "html" ? escapeHtml(value) : value
}

export function authoredText(context: RenderContext, value: string): string {
  return context.format === "html" ? escapeHtml(value) : value
}

export function formatMergeValue(raw: unknown): string {
  if (typeof raw === "string") return raw
  if (typeof raw === "number" || typeof raw === "boolean") return String(raw)

  return ""
}
