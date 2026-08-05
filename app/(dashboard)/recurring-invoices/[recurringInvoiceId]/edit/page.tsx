import { notFound } from "next/navigation"

import { type Metadata } from "next"
import Link from "next/link"

import { t } from "@/lib/i18n/server"

import { Button, Icon, ScrollArea, SidebarTrigger, Typography } from "@/components/ui"

import { RecurringInvoiceForm } from "@/features/recurringInvoices"
import { getRecurringInvoiceEditorData } from "@/features/recurringInvoices/server"

export const metadata: Metadata = {
  title: t("recurringInvoices.metadata.edit")
}

type EditRecurringInvoiceRouteProps = {
  params: Promise<{ recurringInvoiceId: string }>
}

const EditRecurringInvoiceRoute = async ({ params }: EditRecurringInvoiceRouteProps) => {
  const { recurringInvoiceId } = await params

  const editor = await getRecurringInvoiceEditorData({ id: recurringInvoiceId })

  if (!editor.schedule) notFound()

  return (
    <ScrollArea className="size-full">
      <div className="flex w-full flex-col gap-6 p-4 md:p-8">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="md:hidden" />
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
            <Link href={`/recurring-invoices/${recurringInvoiceId}`}>
              <Icon name="ArrowLeft" aria-hidden="true" />
              {t("common.actions.back")}
            </Link>
          </Button>
        </div>
        <header className="space-y-1">
          <Typography variant="h2">{t("recurringInvoices.form.editTitle")}</Typography>
          <Typography variant="p" affects={["muted", "removePMargin"]}>
            {t("recurringInvoices.form.editDescription")}
          </Typography>
        </header>
        <RecurringInvoiceForm data={editor} />
      </div>
    </ScrollArea>
  )
}

export default EditRecurringInvoiceRoute
