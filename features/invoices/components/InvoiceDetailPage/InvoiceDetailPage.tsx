"use client"

import { useMemo, useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import Link from "next/link"

import { useTranslation } from "@/lib/i18n"

import { formatCurrency } from "@/lib/utils"

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Icon,
  ScrollArea,
  SidebarTrigger,
  Typography,
  toast
} from "@/components/ui"

import {
  computeInvoiceEffectiveReceivable,
  computeInvoiceOutstandingAfterCredits,
  sumCreditNoteTotalCents,
  InvoiceCreditNotesCard,
  type CreditNoteListItem
} from "@/features/creditNotes"

import { InvoicePaymentsCard, type PaymentListItem } from "@/features/payments"

import { markInvoicePaid, sendInvoice, softDeleteInvoice } from "../../mutations"
import {
  canTransitionInvoiceStatus,
  deriveInvoiceStatusView,
  isInvoiceEditable
} from "../../services"
import { type InvoiceDetail } from "../../types"
import { DeleteInvoiceDialog } from "../DeleteInvoiceDialog"
import { InvoiceLineItemsTable } from "../InvoiceLineItemsTable"
import { InvoiceStatusBadge } from "../InvoiceStatusBadge"
import { MarkInvoicePaidDialog } from "../MarkInvoicePaidDialog"
import { SendInvoiceDialog } from "../SendInvoiceDialog"

import { InvoicePublicLinkCard } from "./InvoicePublicLinkCard"
import { InvoiceSummaryCard } from "./InvoiceSummaryCard"

type InvoiceDetailPageProps = {
  invoice: InvoiceDetail
  payments: PaymentListItem[]
  creditNotes: CreditNoteListItem[]
}

const InvoiceDetailPage = ({ invoice, payments, creditNotes }: InvoiceDetailPageProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [sendOpen, setSendOpen] = useState(false)
  const [markPaidOpen, setMarkPaidOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isSending, startSending] = useTransition()
  const [isMarkingPaid, startMarkingPaid] = useTransition()
  const [isDeleting, startDeleting] = useTransition()

  const now = useMemo(() => new Date(), [])

  const isEditable = isInvoiceEditable(invoice.status)
  const canMarkPaid = canTransitionInvoiceStatus(invoice.status, "paid").allowed

  const locale = invoice.defaults.defaultLocale

  // The stored `total_cents` is never rewritten by a credit note, so what the invoice is still owed
  // is derived here from the notes standing against it (`@/features/creditNotes`
  // services/effectiveReceivable.ts). Every amount-due figure on this screen reads from these two.
  const creditNoteTotals = creditNotes.map((creditNote) => creditNote.totalCents)
  const creditedCents = sumCreditNoteTotalCents(creditNoteTotals)
  const effectiveReceivableCents = computeInvoiceEffectiveReceivable(
    invoice.totalCents,
    creditNoteTotals
  )
  const outstandingCents = computeInvoiceOutstandingAfterCredits(invoice, creditNoteTotals)

  // A project-scoped invoice is reached through its project; a client-only one has no project route
  // to return to, so the fallback is the client. `chk_invoices_parent` guarantees one of the two.
  const listHref = invoice.projectId
    ? `/projects/${invoice.projectId}/invoices`
    : `/clients/${invoice.clientId}`

  // Every credit-note route is nested under the project-scoped invoice route, so a client-only
  // invoice has no base path to hang them off and the card renders without its links.
  const creditNoteBasePath = invoice.projectId
    ? `/projects/${invoice.projectId}/invoices/${invoice.id}`
    : null

  const onConfirmSend = () => {
    if (isSending) return

    startSending(async () => {
      const result = await sendInvoice({ id: invoice.id })

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      toast.success(t("invoices.notifications.sent"))

      setSendOpen(false)

      router.refresh()
    })
  }

  const onConfirmMarkPaid = () => {
    if (isMarkingPaid) return

    startMarkingPaid(async () => {
      const result = await markInvoicePaid({ id: invoice.id })

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      toast.success(t("invoices.notifications.markedPaid"))

      setMarkPaidOpen(false)

      router.refresh()
    })
  }

  const onConfirmDelete = () => {
    if (isDeleting) return

    startDeleting(async () => {
      const result = await softDeleteInvoice({ id: invoice.id })

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      toast.success(t("invoices.notifications.deleted"))

      router.push(listHref)
      router.refresh()
    })
  }

  return (
    <ScrollArea className="size-full">
      <div className="flex w-full flex-col gap-6 p-4 md:p-8">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="md:hidden" />
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
            <Link href={listHref}>
              <Icon name="ArrowLeft" aria-hidden="true" />
              {t("invoices.detail.backToList")}
            </Link>
          </Button>
        </div>
        <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Typography variant="h2" className="font-mono">
                {invoice.number}
              </Typography>
              <InvoiceStatusBadge status={deriveInvoiceStatusView(invoice, now)} />
            </div>
            <Typography variant="p" affects={["muted", "removePMargin"]}>
              {invoice.projectName || invoice.clientName}
            </Typography>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isEditable ? (
              <Button variant="outline" asChild>
                <Link href={`${listHref}/${invoice.id}/edit`}>
                  <Icon name="Pencil" aria-hidden="true" />
                  {t("invoices.actions.edit")}
                </Link>
              </Button>
            ) : null}
            {isEditable ? (
              <Button onClick={() => setSendOpen(true)}>
                <Icon name="Send" aria-hidden="true" />
                {t("invoices.actions.send")}
              </Button>
            ) : null}
            {canMarkPaid ? (
              <Button onClick={() => setMarkPaidOpen(true)}>
                <Icon name="CircleCheck" aria-hidden="true" />
                {t("invoices.actions.markPaid")}
              </Button>
            ) : null}
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Icon name="Trash2" aria-hidden="true" />
              {t("invoices.actions.delete")}
            </Button>
          </div>
        </header>
        {isEditable ? null : (
          <Alert>
            <Icon name="Lock" aria-hidden="true" />
            <AlertTitle>{t("invoices.detail.lockedTitle")}</AlertTitle>
            <AlertDescription>{t("invoices.detail.lockedDescription")}</AlertDescription>
          </Alert>
        )}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="flex flex-col gap-6 lg:col-span-2">
            <InvoiceLineItemsTable
              lineItems={invoice.lineItems}
              currency={invoice.currency}
              locale={locale}
            />
            {invoice.notes ? (
              <div className="flex flex-col gap-2">
                <Typography affects={["small", "medium"]}>
                  {t("invoices.detail.notesTitle")}
                </Typography>
                <Typography variant="p" affects={["muted", "small", "removePMargin"]}>
                  {invoice.notes}
                </Typography>
              </div>
            ) : null}
            <InvoicePaymentsCard
              invoiceId={invoice.id}
              payments={payments}
              currency={invoice.currency}
              locale={locale}
              amountPaidCents={invoice.amountPaidCents}
              outstandingCents={outstandingCents}
              canRecord={!isEditable}
            />
            <InvoiceCreditNotesCard
              basePath={creditNoteBasePath}
              creditNotes={creditNotes}
              currency={invoice.currency}
              locale={locale}
              creditedCents={creditedCents}
              effectiveReceivableCents={effectiveReceivableCents}
              canIssue={!isEditable}
            />
          </div>
          <div className="flex flex-col gap-6">
            <InvoiceSummaryCard
              invoice={invoice}
              creditedCents={creditedCents}
              outstandingCents={outstandingCents}
            />
            <InvoicePublicLinkCard publicPath={invoice.publicPath} />
          </div>
        </div>
        <SendInvoiceDialog
          open={sendOpen}
          isSending={isSending}
          onOpenChange={(open) => {
            if (!isSending) setSendOpen(open)
          }}
          onConfirm={onConfirmSend}
        />
        <MarkInvoicePaidDialog
          open={markPaidOpen}
          amount={formatCurrency(invoice.totalCents, invoice.currency, locale)}
          isSaving={isMarkingPaid}
          onOpenChange={(open) => {
            if (!isMarkingPaid) setMarkPaidOpen(open)
          }}
          onConfirm={onConfirmMarkPaid}
        />
        <DeleteInvoiceDialog
          open={deleteOpen}
          isDeleting={isDeleting}
          onOpenChange={(open) => {
            if (!isDeleting) setDeleteOpen(open)
          }}
          onConfirm={onConfirmDelete}
        />
      </div>
    </ScrollArea>
  )
}

export { InvoiceDetailPage }
