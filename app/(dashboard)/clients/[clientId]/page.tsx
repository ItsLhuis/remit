import { notFound } from "next/navigation"

import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { ClientDetailPage } from "@/features/clients"
import { getClientDefaults, getClientDetail, getClientForEdit } from "@/features/clients/server"

export const metadata: Metadata = {
  title: t("clients.metadata.detail")
}

type ClientDetailRouteProps = {
  params: Promise<{ clientId: string }>
}

const ClientDetailRoute = async ({ params }: ClientDetailRouteProps) => {
  const { clientId } = await params

  const [client, formData, defaults] = await Promise.all([
    getClientDetail({ id: clientId }),
    getClientForEdit({ id: clientId }),
    getClientDefaults()
  ])

  if (!client || !formData) notFound()

  return <ClientDetailPage client={client} formData={formData} locale={defaults.defaultLocale} />
}

export default ClientDetailRoute
