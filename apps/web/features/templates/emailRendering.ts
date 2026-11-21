import { and, eq, isNull } from "drizzle-orm"

import { database } from "@/database"
import { templates } from "@/database/schema"

import { renderMergeString, renderTemplate, toTemplateEditorData } from "./services"
import { type TemplateRenderData, type TemplateType } from "./services"

// Renders one of the `email_*` template types into a subject and a body, or falls back to the
// caller's copy when the instance has no template of that type.
//
// It lives in `features/templates` rather than in `features/email` on purpose, and the reason is a
// cycle rather than taste: `features/email` is reachable from `lib/auth`, which sends mail, so an
// email module that imported the templates barrel would close the loop
// email → templates → components → lib/auth → email. Keeping the rendering on this side means the
// three feature email jobs import templates and email separately, and neither imports the other.

export type EmailTemplateRender = {
  subject: string
  text: string
  html: string | null
}

export type RenderEmailTemplateInput = {
  templateType: TemplateType
  renderData: TemplateRenderData
  fallbackSubject: string
  fallbackText: string
}

export async function renderEmailTemplate({
  templateType,
  renderData,
  fallbackSubject,
  fallbackText
}: RenderEmailTemplateInput): Promise<EmailTemplateRender> {
  const template = await database.query.templates.findFirst({
    where: and(
      eq(templates.type, templateType),
      eq(templates.isDefault, true),
      isNull(templates.deletedAt)
    )
  })

  // No template of the type is an ordinary state, not an error: a freelancer who never opened the
  // template editor must still be able to invoice.
  if (!template) {
    return { subject: fallbackSubject, text: fallbackText, html: null }
  }

  const editorData = toTemplateEditorData(template)

  const shared = {
    blocks: editorData.blocks,
    renderData,
    type: templateType,
    pageSettings: editorData.pageSettings
  }

  return {
    // `templates.subject` is a bare string rather than a block, so it takes the string substitution
    // path — which does not escape, because a subject line is a header value and `&#39;` would show
    // up literally in a mail client's subject bar.
    subject: template.subject
      ? renderMergeString(template.subject, renderData, templateType)
      : fallbackSubject,
    // The plain-text alternative is rendered from the same blocks rather than stripped out of the
    // HTML, so a client whose reader refuses HTML still gets the authored wording.
    text: renderTemplate({ ...shared, format: "text" }),
    html: renderTemplate({ ...shared, format: "html" })
  }
}
