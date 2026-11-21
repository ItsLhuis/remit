"use client"

import { useTranslation } from "@/lib/i18n"

import { formatCurrency } from "@/lib/utils"

import { StatCard, StatValue } from "@/components/ui"

import { type ExpensesSummary } from "../../types"

type ExpensesSummaryBandProps = {
  summary: ExpensesSummary
  locale: string
}

const ExpensesSummaryBand = ({ summary, locale }: ExpensesSummaryBandProps) => {
  const { t } = useTranslation()

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard icon="Wallet" label={t("expenses.summary.total")}>
        <StatValue
          mono
          value={formatCurrency(summary.totalCents, summary.currency, locale)}
          title={t("expenses.summary.total")}
          hint={t("expenses.summary.totalHint", { count: summary.count })}
        />
      </StatCard>
      <StatCard icon="CircleDollarSign" label={t("expenses.summary.rebillable")}>
        <StatValue
          mono
          value={formatCurrency(summary.rebillableCents, summary.currency, locale)}
          title={t("expenses.summary.rebillable")}
          hint={t("expenses.summary.rebillableHint")}
        />
      </StatCard>
      <StatCard icon="ReceiptText" label={t("expenses.summary.unbilled")}>
        <StatValue
          mono
          value={formatCurrency(summary.unbilledRebillableCents, summary.currency, locale)}
          title={t("expenses.summary.unbilled")}
          hint={t("expenses.summary.unbilledHint")}
        />
      </StatCard>
    </div>
  )
}

export { ExpensesSummaryBand }
