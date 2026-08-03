"use client"

import Link from "next/link"

import { useTranslation } from "@/lib/i18n"

import { formatCurrency } from "@/lib/utils"

import {
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Icon,
  Typography
} from "@/components/ui"

import { type CreditNoteListItem } from "../../types"

import { CreditNoteRow } from "./CreditNoteRow"

// `basePath` is the invoice's own route and is null when the invoice has no project, because every
// credit-note route is nested under one. A card with no base path still reports the figures; it just
// offers no way in or out.
type InvoiceCreditNotesCardProps = {
  basePath: string | null
  creditNotes: CreditNoteListItem[]
  currency: string
  locale: string
  creditedCents: number
  effectiveReceivableCents: number
  canIssue: boolean
}

// Mounted on the invoice detail surface: a credit note has no home of its own on that screen, and
// the figures it moves — credited and effective receivable — only mean anything beside the invoice
// total they adjust.
const InvoiceCreditNotesCard = ({
  basePath,
  creditNotes,
  currency,
  locale,
  creditedCents,
  effectiveReceivableCents,
  canIssue
}: InvoiceCreditNotesCardProps) => {
  const { t } = useTranslation()

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{t("creditNotes.card.title")}</CardTitle>
        <CardDescription>{t("creditNotes.card.description")}</CardDescription>
        {canIssue && basePath ? (
          <CardAction>
            <Button asChild size="sm">
              <Link href={`${basePath}/credit-notes/new`}>
                <Icon name="Plus" aria-hidden="true" />
                {t("creditNotes.actions.create")}
              </Link>
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        {creditNotes.length === 0 ? (
          <Empty className="border-0 py-8">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Icon name="ReceiptText" />
              </EmptyMedia>
              <EmptyTitle>{t("creditNotes.empty.title")}</EmptyTitle>
              <EmptyDescription>
                {canIssue
                  ? t("creditNotes.empty.description")
                  : t("creditNotes.empty.lockedDescription")}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="flex flex-col">
            {creditNotes.map((creditNote) => (
              <CreditNoteRow
                key={creditNote.id}
                creditNote={creditNote}
                href={basePath ? `${basePath}/credit-notes/${creditNote.id}` : null}
                locale={locale}
              />
            ))}
          </ul>
        )}
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-1">
        <div className="flex items-baseline justify-between gap-4">
          <Typography affects={["small", "muted"]}>{t("invoices.totals.credited")}</Typography>
          <span className="font-mono text-sm tabular-nums">
            {formatCurrency(-creditedCents, currency, locale)}
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <Typography affects={["small", "medium"]}>
            {t("invoices.totals.effectiveReceivable")}
          </Typography>
          <span className="font-mono text-sm font-semibold tabular-nums">
            {formatCurrency(effectiveReceivableCents, currency, locale)}
          </span>
        </div>
      </CardFooter>
    </Card>
  )
}

export { InvoiceCreditNotesCard }
