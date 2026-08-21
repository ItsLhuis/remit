import { type ProjectListItem } from "@/features/projects"

import { type ClientContact, type ClientDetail, type ClientFormData } from "../types"

import { ClientWorkspace } from "./ClientWorkspace"

type ClientDetailPageProps = {
  client: ClientDetail
  projects: ProjectListItem[]
  contacts: ClientContact[]
  formData: ClientFormData
  locale: string
}

const ClientDetailPage = ({
  client,
  projects,
  contacts,
  formData,
  locale
}: ClientDetailPageProps) => {
  return (
    <ClientWorkspace
      client={client}
      projects={projects}
      contacts={contacts}
      formData={formData}
      locale={locale}
    />
  )
}

export { ClientDetailPage }
