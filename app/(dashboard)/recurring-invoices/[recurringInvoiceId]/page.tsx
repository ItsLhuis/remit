import { notFound } from "next/navigation"

import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { RecurringInvoiceDetailPage } from "@/features/recurringInvoices"
import {
  getRecurringInvoiceDefaults,
  getRecurringInvoiceDetail
} from "@/features/recurringInvoices/server"

export const metadata: Metadata = {
  title: t("recurringInvoices.metadata.detail")
}

type RecurringInvoiceDetailRouteProps = {
  params: Promise<{ recurringInvoiceId: string }>
}

const RecurringInvoiceDetailRoute = async ({ params }: RecurringInvoiceDetailRouteProps) => {
  const { recurringInvoiceId } = await params

  const [schedule, defaults] = await Promise.all([
    getRecurringInvoiceDetail({ id: recurringInvoiceId }),
    getRecurringInvoiceDefaults()
  ])

  if (!schedule) notFound()

  return (
    <RecurringInvoiceDetailPage
      schedule={schedule}
      locale={defaults.defaultLocale}
      timeZone={defaults.defaultTimezone}
    />
  )
}

export default RecurringInvoiceDetailRoute
