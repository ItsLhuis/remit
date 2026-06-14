import { type Metadata } from "next"

import { notFound } from "next/navigation"

import { t } from "@/lib/i18n/server"

import { getClientDefaults, getClientDetail } from "@/features/clients/server"

import { ClientDetailPage } from "@/features/clients"

export const metadata: Metadata = {
  title: t("clients.metadata.detail")
}

type ClientDetailRouteProps = {
  params: Promise<{ clientId: string }>
}

const ClientDetailRoute = async ({ params }: ClientDetailRouteProps) => {
  const { clientId } = await params

  const [client, defaults] = await Promise.all([
    getClientDetail({ id: clientId }),
    getClientDefaults()
  ])

  if (!client) notFound()

  return <ClientDetailPage client={client} locale={defaults.defaultLocale} />
}

export default ClientDetailRoute
