import { notFound } from "next/navigation"

import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { getEntityActivity } from "@/features/activityLog/server"

import { ClientDetailPage } from "@/features/clients"
import {
  getClientDefaults,
  getClientDetail,
  getClientForEdit,
  listClientContacts
} from "@/features/clients/server"

import { listInvoicesByClient } from "@/features/invoices/server"

import { listProjectsByClient } from "@/features/projects/server"

export const metadata: Metadata = {
  title: t("clients.metadata.detail")
}

type ClientDetailRouteProps = {
  params: Promise<{ clientId: string }>
}

const ClientDetailRoute = async ({ params }: ClientDetailRouteProps) => {
  const { clientId } = await params

  const [client, formData, defaults, contacts, activity] = await Promise.all([
    getClientDetail({ id: clientId }),
    getClientForEdit({ id: clientId }),
    getClientDefaults(),
    listClientContacts({ id: clientId }),
    getEntityActivity({ entityType: "client", entityId: clientId })
  ])

  if (!client || !formData) notFound()

  const [projects, invoices] = await Promise.all([
    listProjectsByClient(clientId, client.currency),
    listInvoicesByClient(clientId, client.currency)
  ])

  return (
    <ClientDetailPage
      client={client}
      projects={projects}
      invoices={invoices}
      contacts={contacts}
      activity={activity}
      formData={formData}
      locale={defaults.defaultLocale}
    />
  )
}

export default ClientDetailRoute
