import { type EntityActivityPanelData } from "@/features/activityLog"

import { type AttachmentListItem } from "@/features/attachments"

import { type InvoiceListItem } from "@/features/invoices"

import { type ProjectListItem } from "@/features/projects"

import { type ClientContact, type ClientDetail, type ClientFormData } from "../types"

import { ClientWorkspace } from "./ClientWorkspace"

type ClientDetailPageProps = {
  client: ClientDetail
  projects: ProjectListItem[]
  invoices: InvoiceListItem[]
  contacts: ClientContact[]
  activity: EntityActivityPanelData
  attachments: AttachmentListItem[]
  canWriteAttachments: boolean
  formData: ClientFormData
  locale: string
}

const ClientDetailPage = ({
  client,
  projects,
  invoices,
  contacts,
  activity,
  attachments,
  canWriteAttachments,
  formData,
  locale
}: ClientDetailPageProps) => {
  return (
    <ClientWorkspace
      client={client}
      projects={projects}
      invoices={invoices}
      contacts={contacts}
      activity={activity}
      attachments={attachments}
      canWriteAttachments={canWriteAttachments}
      formData={formData}
      locale={locale}
    />
  )
}

export { ClientDetailPage }
