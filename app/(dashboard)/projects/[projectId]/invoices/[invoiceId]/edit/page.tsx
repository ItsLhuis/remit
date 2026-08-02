import { notFound, redirect } from "next/navigation"

import { type Metadata } from "next"
import Link from "next/link"

import { t } from "@/lib/i18n/server"

import { Button, Icon, ScrollArea, SidebarTrigger, Typography } from "@/components/ui"

import { InvoiceForm, isInvoiceEditable } from "@/features/invoices"
import { getInvoiceEditorData, getInvoiceForEdit } from "@/features/invoices/server"

export const metadata: Metadata = {
  title: t("invoices.metadata.edit")
}

type EditInvoiceRouteProps = {
  params: Promise<{ projectId: string; invoiceId: string }>
}

const EditInvoiceRoute = async ({ params }: EditInvoiceRouteProps) => {
  const { projectId, invoiceId } = await params

  const [editor, invoice] = await Promise.all([
    getInvoiceEditorData({ projectId }),
    getInvoiceForEdit({ id: invoiceId })
  ])

  if (!editor || !invoice) notFound()

  // The server action rejects a non-draft write on its own; this only keeps the route from rendering
  // a form whose every submission would fail.
  if (!isInvoiceEditable(invoice.status)) {
    redirect(`/projects/${projectId}/invoices/${invoiceId}`)
  }

  return (
    <ScrollArea className="size-full">
      <div className="flex w-full flex-col gap-6 p-4 md:p-8">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="md:hidden" />
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
            <Link href={`/projects/${projectId}/invoices/${invoiceId}`}>
              <Icon name="ArrowLeft" aria-hidden="true" />
              {t("invoices.form.backToInvoice")}
            </Link>
          </Button>
        </div>
        <header className="space-y-1">
          <div className="flex items-center gap-3">
            <Typography variant="h2">{t("invoices.form.editTitle")}</Typography>
          </div>
          <Typography variant="p" affects={["muted", "removePMargin"]}>
            {t("invoices.form.editDescription")}
          </Typography>
        </header>
        <InvoiceForm editor={editor} invoice={invoice} />
      </div>
    </ScrollArea>
  )
}

export default EditInvoiceRoute
