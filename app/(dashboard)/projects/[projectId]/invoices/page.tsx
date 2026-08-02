import { notFound } from "next/navigation"

import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { InvoicesListPage } from "@/features/invoices"
import { getInvoicesPageData, listConvertibleProposals } from "@/features/invoices/server"

export const metadata: Metadata = {
  title: t("invoices.metadata.list")
}

type InvoicesRouteProps = {
  params: Promise<{ projectId: string }>
}

const InvoicesRoute = async ({ params }: InvoicesRouteProps) => {
  const { projectId } = await params

  const [data, convertibleProposals] = await Promise.all([
    getInvoicesPageData({ projectId }),
    listConvertibleProposals({ projectId })
  ])

  if (!data) notFound()

  return <InvoicesListPage data={data} convertibleProposals={convertibleProposals} />
}

export default InvoicesRoute
