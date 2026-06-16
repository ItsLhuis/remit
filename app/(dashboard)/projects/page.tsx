import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { listClientOptions } from "@/features/clients/server"

import { getProjectsPageData } from "@/features/projects/server"

import { ProjectsListPage } from "@/features/projects"

export const metadata: Metadata = {
  title: t("projects.metadata.list")
}

type ProjectsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const ProjectsPage = async ({ searchParams }: ProjectsPageProps) => {
  const [data, clients] = await Promise.all([
    getProjectsPageData(await searchParams),
    listClientOptions()
  ])

  return <ProjectsListPage data={data} clients={clients} />
}

export default ProjectsPage
