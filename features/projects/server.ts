export {
  createProject,
  restoreProject,
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

// Also exported from the client-safe `index.ts`, and reachable from a server module without it:
// `features/api/resources.ts` feeds the list read the same parsed query the projects screen does,
// and reaching it through the root barrel would drag the component graph into a route handler.
export { parseProjectListQuery } from "./schemas"
