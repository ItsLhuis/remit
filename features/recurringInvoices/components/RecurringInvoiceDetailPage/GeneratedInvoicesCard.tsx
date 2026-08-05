"use client"

import Link from "next/link"

import { useTranslation } from "@/lib/i18n"

import { formatCurrency, formatDay } from "@/lib/utils"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Icon,
  Typography
} from "@/components/ui"

import { type RecurringInvoiceGeneratedInvoice } from "../../types"

type GeneratedInvoiceRowProps = {
  invoice: RecurringInvoiceGeneratedInvoice
  href: string | null
  locale: string
}

const GeneratedInvoiceRow = ({ invoice, href, locale }: GeneratedInvoiceRowProps) => (
  <li className="border-border flex items-center justify-between gap-3 border-b py-3 last:border-b-0">
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      {href ? (
        <Link href={href} className="font-mono text-sm font-medium hover:underline">
          {invoice.number}
        </Link>
      ) : (
        <span className="font-mono text-sm font-medium">{invoice.number}</span>
      )}
      {invoice.issueDate ? (
        <Typography affects={["small", "muted"]}>{formatDay(invoice.issueDate, locale)}</Typography>
      ) : null}
    </div>
    <span className="shrink-0 font-mono text-sm font-medium tabular-nums">
      {formatCurrency(invoice.totalCents, invoice.currency, locale)}
    </span>
  </li>
)

// `projectId` is the schedule's own project, because every invoice the generation job raises copies
// it (features/recurringInvoices/jobs.ts). The invoice detail route is nested under a project, so a
// schedule billing a client directly has nowhere to link and its rows stay as plain text.
type GeneratedInvoicesCardProps = {
  invoices: RecurringInvoiceGeneratedInvoice[]
  projectId: string | null
  locale: string
}

const GeneratedInvoicesCard = ({ invoices, projectId, locale }: GeneratedInvoicesCardProps) => {
  const { t } = useTranslation()

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{t("recurringInvoices.detail.generatedInvoices")}</CardTitle>
      </CardHeader>
      <CardContent>
        {invoices.length === 0 ? (
          <Empty className="border-0 py-8">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Icon name="ReceiptText" />
              </EmptyMedia>
              <EmptyTitle>{t("recurringInvoices.detail.generatedInvoicesEmpty")}</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="flex flex-col">
            {invoices.map((invoice) => (
              <GeneratedInvoiceRow
                key={invoice.id}
                invoice={invoice}
                href={projectId ? `/projects/${projectId}/invoices/${invoice.id}` : null}
                locale={locale}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

export { GeneratedInvoicesCard }
