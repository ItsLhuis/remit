import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { getClientsPageData } from "@/features/clients/server"

import { ClientsListPage } from "@/features/clients"

export const metadata: Metadata = {
  title: t("clients.metadata.list")
}

type ClientsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const ClientsPage = async ({ searchParams }: ClientsPageProps) => {
  const data = await getClientsPageData(await searchParams)

  return <ClientsListPage data={data} />
}

export default ClientsPage
