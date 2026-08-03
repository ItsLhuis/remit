import { notFound } from "next/navigation"

import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { InvoiceDetailPage } from "@/features/invoices"
import { getInvoiceDetail } from "@/features/invoices/server"

import { listInvoicePayments } from "@/features/payments/server"

export const metadata: Metadata = {
  title: t("invoices.metadata.detail")
}

type InvoiceRouteProps = {
  params: Promise<{ invoiceId: string }>
}

const InvoiceRoute = async ({ params }: InvoiceRouteProps) => {
  const { invoiceId } = await params

  const [invoice, payments] = await Promise.all([
    getInvoiceDetail({ id: invoiceId }),
    listInvoicePayments({ invoiceId })
  ])

  if (!invoice) notFound()

  return <InvoiceDetailPage invoice={invoice} payments={payments} />
}

export default InvoiceRoute
