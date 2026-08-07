import { type EntityActivityPanelData } from "@/features/activityLog"

import { type ProjectClientOption, type ProjectDetail, type ProjectFormData } from "../types"

import { ProjectWorkspace } from "./ProjectWorkspace"

type ProjectDetailPageProps = {
  project: ProjectDetail
  formData: ProjectFormData
  clients: ProjectClientOption[]
  locale: string
  activity: EntityActivityPanelData
}

const ProjectDetailPage = ({
  project,
  formData,
  clients,
  locale,
  activity
}: ProjectDetailPageProps) => {
  return (
    <ProjectWorkspace
      project={project}
      formData={formData}
      clients={clients}
      locale={locale}
      activity={activity}
    />
  )
}

export { ProjectDetailPage }
