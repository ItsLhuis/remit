import { notFound } from "next/navigation"

import { type Metadata } from "next"
import Link from "next/link"

import { t } from "@/lib/i18n/server"

import { Button, Icon, ScrollArea, SidebarTrigger, Typography } from "@/components/ui"

import { CreditNoteForm } from "@/features/creditNotes"
import { getCreditNoteEditorData } from "@/features/creditNotes/server"

export const metadata: Metadata = {
  title: t("creditNotes.metadata.create")
}

type NewCreditNoteRouteProps = {
  params: Promise<{ projectId: string; invoiceId: string }>
}

const NewCreditNoteRoute = async ({ params }: NewCreditNoteRouteProps) => {
  const { projectId, invoiceId } = await params

  // Returns null for a draft invoice as well as a missing one: a draft cannot be credited, and the
  // form would be filled in only to be rejected by the action.
  const editor = await getCreditNoteEditorData({ invoiceId })

  if (!editor) notFound()

  return (
    <ScrollArea className="size-full">
      <div className="flex w-full flex-col gap-6 p-4 md:p-8">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="md:hidden" />
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
            <Link href={`/projects/${projectId}/invoices/${invoiceId}`}>
              <Icon name="ArrowLeft" aria-hidden="true" />
              {t("creditNotes.actions.backToInvoice")}
            </Link>
          </Button>
        </div>
        <header className="space-y-1">
          <Typography variant="h2">{t("creditNotes.form.createTitle")}</Typography>
          <Typography variant="p" affects={["muted", "removePMargin"]}>
            {t("creditNotes.form.createDescription")}
          </Typography>
          <Typography variant="p" affects={["muted", "small", "removePMargin"]}>
            {t("creditNotes.form.creditingInvoice", {
              number: editor.invoiceNumber,
              client: editor.clientName || t("creditNotes.overview.noClient")
            })}
          </Typography>
        </header>
        <CreditNoteForm editor={editor} />
      </div>
    </ScrollArea>
  )
}

export default NewCreditNoteRoute
