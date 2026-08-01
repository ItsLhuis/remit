export {
  createTemplate,
  setDefaultTemplate,
  softDeleteTemplate,
  updateTemplate,
  type DeleteTemplateResult,
  type SetDefaultTemplateResult,
  type TemplateMutationResult
} from "./mutations"

export {
  getTemplateForEdit,
  getTemplatesPageData,
  resolveTemplateAssets,
  toTemplateEditorData
} from "./queries"

export { emitTemplateCreated, emitTemplateDeleted, emitTemplateUpdated } from "./events"
