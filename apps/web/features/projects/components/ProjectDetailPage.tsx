import { type EntityActivityPanelData } from "@/features/activityLog"

import { type AttachmentListItem } from "@/features/attachments"

import { type ProjectClientOption, type ProjectDetail, type ProjectFormData } from "../types"

import { ProjectWorkspace } from "./ProjectWorkspace"

type ProjectDetailPageProps = {
  project: ProjectDetail
  formData: ProjectFormData
  clients: ProjectClientOption[]
  locale: string
  activity: EntityActivityPanelData
  attachments: AttachmentListItem[]
  canWriteAttachments: boolean
}

const ProjectDetailPage = ({
  project,
  formData,
  clients,
  locale,
  activity,
  attachments,
  canWriteAttachments
}: ProjectDetailPageProps) => {
  return (
    <ProjectWorkspace
      project={project}
      formData={formData}
      clients={clients}
      locale={locale}
      activity={activity}
      attachments={attachments}
      canWriteAttachments={canWriteAttachments}
    />
  )
}

export { ProjectDetailPage }
