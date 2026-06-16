import { type ProjectClientOption, type ProjectDetail, type ProjectFormData } from "../types"

import { ProjectWorkspace } from "./ProjectWorkspace"

type ProjectDetailPageProps = {
  project: ProjectDetail
  formData: ProjectFormData
  clients: ProjectClientOption[]
  locale: string
}

const ProjectDetailPage = ({ project, formData, clients, locale }: ProjectDetailPageProps) => {
  return (
    <ProjectWorkspace project={project} formData={formData} clients={clients} locale={locale} />
  )
}

export { ProjectDetailPage }
