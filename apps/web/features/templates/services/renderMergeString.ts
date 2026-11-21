import { type TemplateType } from "../schemas"

import { MERGE_TOKEN_SOURCE, type TemplateRenderData } from "./mergeVariables"
import { createRenderContext, mergeValue } from "./renderContext"

// Substitutes merge tokens into a bare string, for the one piece of a document email that is not a
// block: `templates.subject`. The block renderer cannot be reused because a subject line is not
// markup — running it through the HTML path would escape apostrophes into entities that a mail
// client shows literally in the subject bar.
//
// It shares the substitution machinery rather than reimplementing it, so a subject obeys the same
// per-type whitelist as the body: an identifier outside the whitelist resolves to an empty string
// and is never evaluated (`mergeVariables.ts`).
export function renderMergeString(
  source: string,
  renderData: TemplateRenderData,
  type: TemplateType
): string {
  // The "text" format, so values arrive unescaped. That is correct for a header value and would be
  // wrong for markup; the body keeps using `renderTemplate`, which escapes.
  const context = createRenderContext(renderData, type, "text", {})
  const pattern = new RegExp(MERGE_TOKEN_SOURCE, "g")

  return source.replace(pattern, (_match, path: string) => mergeValue(context, path))
}
