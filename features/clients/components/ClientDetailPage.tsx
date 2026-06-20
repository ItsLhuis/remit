import { type ProjectListItem } from "@/features/projects"

import { type ClientDetail, type ClientFormData } from "../types"

import { ClientWorkspace } from "./ClientWorkspace"

type ClientDetailPageProps = {
  client: ClientDetail
  projects: ProjectListItem[]
  formData: ClientFormData
  locale: string
}

const ClientDetailPage = ({ client, projects, formData, locale }: ClientDetailPageProps) => {
  return <ClientWorkspace client={client} projects={projects} formData={formData} locale={locale} />
}

export { ClientDetailPage }
