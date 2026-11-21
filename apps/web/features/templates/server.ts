export {
  createTemplate,
  setDefaultTemplate,
  restoreTemplate,
  softDeleteTemplate,
  updateTemplate,
  type DeleteTemplateResult,
  type SetDefaultTemplateResult,
  type TemplateMutationResult
} from "./mutations"

export { getTemplateForEdit, getTemplatesPageData, resolveTemplateAssets } from "./queries"

export { emitTemplateCreated, emitTemplateDeleted, emitTemplateUpdated } from "./events"

export { toTemplateEditorData } from "./services"

export {
  documentLayoutPlaces,
  resolveDocumentLayout,
  type DocumentLayout,
  type ResolveDocumentLayoutInput
} from "./documentLayout"

export {
  renderEmailTemplate,
  type EmailTemplateRender,
  type RenderEmailTemplateInput
} from "./emailRendering"
