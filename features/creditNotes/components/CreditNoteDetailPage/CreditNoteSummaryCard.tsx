"use client"

import { useTranslation } from "@/lib/i18n"

import { formatCurrency, formatDate } from "@/lib/utils"

import { Card, CardContent, CardHeader, CardTitle, Separator, Typography } from "@/components/ui"

import { type CreditNoteDetail } from "../../types"
import { CreditNoteDetailRow } from "../CreditNoteDetailRow"

type CreditNoteSummaryCardProps = {
  creditNote: CreditNoteDetail
}

const CreditNoteSummaryCard = ({ creditNote }: CreditNoteSummaryCardProps) => {
  const { t } = useTranslation()

  const locale = creditNote.defaults.defaultLocale
  const timeZone = creditNote.defaults.defaultTimezone

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{t("creditNotes.detail.summaryTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <CreditNoteDetailRow
          label={t("creditNotes.fields.invoice")}
          value={creditNote.invoiceNumber}
          mono
        />
        <CreditNoteDetailRow
          label={t("creditNotes.fields.client")}
          value={creditNote.clientName || t("creditNotes.overview.noClient")}
        />
        <CreditNoteDetailRow
          label={t("creditNotes.fields.issuedAt")}
          value={formatDate(creditNote.issuedAt, { locale, timeZone })}
        />
        <Separator />
        <CreditNoteDetailRow
          label={t("creditNotes.totals.subtotal")}
          value={formatCurrency(creditNote.subtotalCents, creditNote.currency, locale)}
          mono
        />
        <CreditNoteDetailRow
          label={t("creditNotes.totals.tax")}
          value={formatCurrency(creditNote.taxAmountCents, creditNote.currency, locale)}
          mono
        />
        <Separator />
        <div className="flex items-baseline justify-between gap-4">
          <Typography affects={["small", "medium"]}>{t("creditNotes.totals.total")}</Typography>
          <span className="font-mono text-lg font-semibold tabular-nums">
            {formatCurrency(creditNote.totalCents, creditNote.currency, locale)}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

export { CreditNoteSummaryCard }
