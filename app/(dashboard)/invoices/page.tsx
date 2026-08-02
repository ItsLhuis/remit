import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { InvoicesOverviewPage } from "@/features/invoices"
import { getInvoiceOverviewPageData } from "@/features/invoices/server"

export const metadata: Metadata = {
  title: t("invoices.metadata.list")
}

type InvoicesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const InvoicesPage = async ({ searchParams }: InvoicesPageProps) => {
  const data = await getInvoiceOverviewPageData(await searchParams)

  return <InvoicesOverviewPage data={data} />
}

export default InvoicesPage
