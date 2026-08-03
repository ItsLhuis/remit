"use client"

import { useTranslation } from "@/lib/i18n"

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle, Icon } from "@/components/ui"

// The single surface behind every dead-end on `/i/[token]`: an unknown token, an archived invoice,
// an invoice still in draft, and a server fault all render exactly this. Adding a case-specific
// message here would undo the whole point — see `getPublicInvoice`.
const PublicInvoiceUnavailable = () => {
  const { t } = useTranslation()

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <Empty className="ring-foreground/10 max-w-md rounded-xl ring-1">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Icon name="FileQuestionMark" aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>{t("invoices.public.unavailable.title")}</EmptyTitle>
          <EmptyDescription>{t("invoices.public.unavailable.description")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </main>
  )
}

export { PublicInvoiceUnavailable }
