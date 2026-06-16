export {
  createProject,
  softDeleteProject,
  updateProject,
  updateProjectStatus,
  type DeleteProjectResult,
  type ProjectMutationResult
} from "./mutations"

export {
  getProjectDefaults,
  getProjectDetail,
  getProjectForEdit,
  getProjectsPageData,
  getProjectsSummary,
  listProjects,
  listProjectsByClient
} from "./queries"

export {
  emitProjectCreated,
  emitProjectDeleted,
  emitProjectStatusChanged,
  emitProjectUpdated
} from "./events"
