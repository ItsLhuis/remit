"use client"

import { useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import Link from "next/link"

import { useTranslation } from "@/lib/i18n"

import { Button, Icon, ScrollArea, SidebarTrigger, Typography, toast } from "@/components/ui"

import { softDeleteCreditNote } from "../../mutations"
import { type CreditNoteDetail } from "../../types"
import { CreditNoteLineItemsTable } from "../CreditNoteLineItemsTable"
import { DeleteCreditNoteDialog } from "../DeleteCreditNoteDialog"

import { CreditNoteSummaryCard } from "./CreditNoteSummaryCard"

type CreditNoteDetailPageProps = {
  creditNote: CreditNoteDetail
}

const CreditNoteDetailPage = ({ creditNote }: CreditNoteDetailPageProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, startDeleting] = useTransition()

  const locale = creditNote.defaults.defaultLocale

  // A credit note is always reached through the invoice it adjusts; the instance-wide list is the
  // fallback for an invoice that has no project route of its own.
  const invoiceHref = creditNote.projectId
    ? `/projects/${creditNote.projectId}/invoices/${creditNote.invoiceId}`
    : "/credit-notes"

  const onConfirmDelete = () => {
    if (isDeleting) return

    startDeleting(async () => {
      const result = await softDeleteCreditNote({ id: creditNote.id })

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      toast.success(t("creditNotes.notifications.deleted"))

      router.push(invoiceHref)
      router.refresh()
    })
  }

  return (
    <ScrollArea className="size-full">
      <div className="flex w-full flex-col gap-6 p-4 md:p-8">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="md:hidden" />
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
            <Link href={invoiceHref}>
              <Icon name="ArrowLeft" aria-hidden="true" />
              {creditNote.projectId
                ? t("creditNotes.actions.backToInvoice")
                : t("creditNotes.actions.backToList")}
            </Link>
          </Button>
        </div>
        <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <Typography variant="h2" className="font-mono">
              {creditNote.number}
            </Typography>
            <Typography variant="p" affects={["muted", "removePMargin"]}>
              {t("creditNotes.form.creditingInvoice", {
                number: creditNote.invoiceNumber,
                client: creditNote.clientName || t("creditNotes.overview.noClient")
              })}
            </Typography>
          </div>
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Icon name="Trash2" aria-hidden="true" />
            {t("creditNotes.actions.delete")}
          </Button>
        </header>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="flex flex-col gap-6 lg:col-span-2">
            <CreditNoteLineItemsTable
              lineItems={creditNote.lineItems}
              currency={creditNote.currency}
              locale={locale}
            />
            <div className="flex flex-col gap-2">
              <Typography affects={["small", "medium"]}>
                {t("creditNotes.detail.reasonTitle")}
              </Typography>
              <Typography variant="p" affects={["muted", "small", "removePMargin"]}>
                {creditNote.reason || t("creditNotes.detail.noReason")}
              </Typography>
            </div>
          </div>
          <CreditNoteSummaryCard creditNote={creditNote} />
        </div>
        <DeleteCreditNoteDialog
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

export { CreditNoteDetailPage }
