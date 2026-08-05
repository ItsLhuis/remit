import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { RecurringInvoicesOverviewPage } from "@/features/recurringInvoices"
import { getRecurringInvoicesPageData } from "@/features/recurringInvoices/server"

export const metadata: Metadata = {
  title: t("recurringInvoices.metadata.list")
}

type RecurringInvoicesRouteProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const RecurringInvoicesRoute = async ({ searchParams }: RecurringInvoicesRouteProps) => {
  const data = await getRecurringInvoicesPageData(await searchParams)

  return <RecurringInvoicesOverviewPage data={data} />
}

export default RecurringInvoicesRoute
