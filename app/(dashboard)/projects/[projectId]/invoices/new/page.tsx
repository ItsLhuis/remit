import { notFound } from "next/navigation"

import { type Metadata } from "next"
import Link from "next/link"

import { t } from "@/lib/i18n/server"

import { Button, Icon, ScrollArea, SidebarTrigger, Typography } from "@/components/ui"

import { InvoiceForm } from "@/features/invoices"
import { getInvoiceEditorData } from "@/features/invoices/server"

export const metadata: Metadata = {
  title: t("invoices.metadata.create")
}

type NewInvoiceRouteProps = {
  params: Promise<{ projectId: string }>
}

const NewInvoiceRoute = async ({ params }: NewInvoiceRouteProps) => {
  const { projectId } = await params

  const editor = await getInvoiceEditorData({ projectId })

  if (!editor) notFound()

  return (
    <ScrollArea className="size-full">
      <div className="flex w-full flex-col gap-6 p-4 md:p-8">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="md:hidden" />
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
            <Link href={`/projects/${projectId}/invoices`}>
              <Icon name="ArrowLeft" aria-hidden="true" />
              {t("invoices.form.backToList")}
            </Link>
          </Button>
        </div>
        <header className="space-y-1">
          <div className="flex items-center gap-3">
            <Typography variant="h2">{t("invoices.form.createTitle")}</Typography>
          </div>
          <Typography variant="p" affects={["muted", "removePMargin"]}>
            {t("invoices.form.createDescription")}
          </Typography>
        </header>
        <InvoiceForm editor={editor} invoice={null} />
      </div>
    </ScrollArea>
  )
}

export default NewInvoiceRoute
