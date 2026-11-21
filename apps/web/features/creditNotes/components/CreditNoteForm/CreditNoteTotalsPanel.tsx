"use client"

import { useTranslation } from "@/lib/i18n"

import { formatCurrency } from "@/lib/utils"

import { Card, CardContent, Separator } from "@/components/ui"

import { type CreditNoteTotals } from "../../services"
import { CreditNoteDetailRow } from "../CreditNoteDetailRow"

type CreditNoteTotalsPanelProps = {
  totals: CreditNoteTotals
  outstandingCents: number
  currency: string
  locale: string
}

// The outstanding figure sits beside the running total on purpose: it is the number that tells the
// user whether the credit they are about to issue over-credits the invoice, and over-crediting is
// allowed but ought to be a decision rather than an accident (services/effectiveReceivable.ts).
const CreditNoteTotalsPanel = ({
  totals,
  outstandingCents,
  currency,
  locale
}: CreditNoteTotalsPanelProps) => {
  const { t } = useTranslation()

  return (
    <Card size="sm" className="sm:ml-auto sm:w-80">
      <CardContent className="flex flex-col gap-2">
        <CreditNoteDetailRow
          label={t("creditNotes.totals.outstanding")}
          value={formatCurrency(outstandingCents, currency, locale)}
          mono
        />
        <Separator />
        <CreditNoteDetailRow
          label={t("creditNotes.totals.subtotal")}
          value={formatCurrency(totals.subtotalCents, currency, locale)}
          mono
        />
        <CreditNoteDetailRow
          label={t("creditNotes.totals.tax")}
          value={formatCurrency(totals.taxAmountCents, currency, locale)}
          mono
        />
        <Separator />
        <CreditNoteDetailRow
          label={t("creditNotes.totals.total")}
          value={formatCurrency(totals.totalCents, currency, locale)}
          emphasis
        />
      </CardContent>
    </Card>
  )
}

export { CreditNoteTotalsPanel }
