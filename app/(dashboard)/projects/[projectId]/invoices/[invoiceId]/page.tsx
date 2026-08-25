import { notFound } from "next/navigation"

import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { canWriteAttachments, listAttachments } from "@/features/attachments/server"

import { listInvoiceCreditNotes } from "@/features/creditNotes/server"

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

  const [invoice, payments, creditNotes, attachments, canWriteFiles] = await Promise.all([
    getInvoiceDetail({ id: invoiceId }),
    listInvoicePayments({ invoiceId }),
    listInvoiceCreditNotes({ invoiceId }),
    listAttachments({ parentType: "invoice", parentId: invoiceId }),
    canWriteAttachments()
  ])

  if (!invoice) notFound()

  return (
    <InvoiceDetailPage
      invoice={invoice}
      payments={payments}
      creditNotes={creditNotes}
      attachments={attachments}
      canWriteAttachments={canWriteFiles}
    />
  )
}

export default InvoiceRoute
