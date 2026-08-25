import { notFound } from "next/navigation"

import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { getEntityActivity } from "@/features/activityLog/server"

import { canWriteAttachments, listAttachments } from "@/features/attachments/server"

import { listClientOptions } from "@/features/clients/server"

import { ProjectDetailPage } from "@/features/projects"
import { getProjectDefaults, getProjectDetail, getProjectForEdit } from "@/features/projects/server"

export const metadata: Metadata = {
  title: t("projects.metadata.detail")
}

type ProjectDetailRouteProps = {
  params: Promise<{ projectId: string }>
}

const ProjectDetailRoute = async ({ params }: ProjectDetailRouteProps) => {
  const { projectId } = await params

  const [project, formData, clients, defaults, activity, attachments, canWriteFiles] =
    await Promise.all([
      getProjectDetail({ id: projectId }),
      getProjectForEdit({ id: projectId }),
      listClientOptions(),
      getProjectDefaults(),
      getEntityActivity({ entityType: "project", entityId: projectId }),
      listAttachments({ parentType: "project", parentId: projectId }),
      canWriteAttachments()
    ])

  if (!project || !formData) notFound()

  return (
    <ProjectDetailPage
      project={project}
      formData={formData}
      clients={clients}
      locale={defaults.defaultLocale}
      activity={activity}
      attachments={attachments}
      canWriteAttachments={canWriteFiles}
    />
  )
}

export default ProjectDetailRoute
