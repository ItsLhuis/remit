import { type Metadata } from "next"
import Link from "next/link"

import { t } from "@/lib/i18n/server"

import { Button, Icon, ScrollArea, SidebarTrigger, Typography } from "@/components/ui"

import { RecurringInvoiceForm } from "@/features/recurringInvoices"
import { getRecurringInvoiceEditorData } from "@/features/recurringInvoices/server"

export const metadata: Metadata = {
  title: t("recurringInvoices.metadata.create")
}

const NewRecurringInvoiceRoute = async () => {
  const editor = await getRecurringInvoiceEditorData()

  return (
    <ScrollArea className="size-full">
      <div className="flex w-full flex-col gap-6 p-4 md:p-8">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="md:hidden" />
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
            <Link href="/recurring-invoices">
              <Icon name="ArrowLeft" aria-hidden="true" />
              {t("common.actions.back")}
            </Link>
          </Button>
        </div>
        <header className="space-y-1">
          <Typography variant="h2">{t("recurringInvoices.form.createTitle")}</Typography>
          <Typography variant="p" affects={["muted", "removePMargin"]}>
            {t("recurringInvoices.form.createDescription")}
          </Typography>
        </header>
        <RecurringInvoiceForm data={editor} />
      </div>
    </ScrollArea>
  )
}

export default NewRecurringInvoiceRoute
