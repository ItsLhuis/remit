"use client"

import { useTranslation } from "@/lib/i18n"

import { formatCurrency } from "@/lib/utils"

import { Typography } from "@/components/ui"

import { type DashboardPageData } from "../../types"

import { DashboardMoneyTile } from "./DashboardMoneyTile"

type DashboardSummaryBandProps = {
  data: DashboardPageData
}

const DashboardSummaryBand = ({ data }: DashboardSummaryBandProps) => {
  const { t } = useTranslation()

  const locale = data.defaults.defaultLocale
  const { currency, expenses, receivables, revenue } = data

  const hasRevenue = revenue.yearToDateCents > 0 || revenue.monthToDateCents > 0
  const hasExpenses = expenses.count > 0

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <DashboardMoneyTile
          icon="Banknote"
          label={t("dashboard.tiles.revenue")}
          cents={revenue.monthToDateCents}
          currency={currency}
          locale={locale}
          hint={t("dashboard.tiles.revenueHint", {
            amount: formatCurrency(revenue.yearToDateCents, currency, locale)
          })}
          emptyHint={t("dashboard.tiles.revenueEmptyHint")}
          isEmpty={!hasRevenue}
          action={{ label: t("dashboard.tiles.revenueAction"), href: "/invoices" }}
        />
        <DashboardMoneyTile
          icon="Wallet"
          label={t("dashboard.tiles.outstanding")}
          cents={receivables.outstandingCents}
          currency={currency}
          locale={locale}
          hint={t("dashboard.tiles.outstandingHint", { count: receivables.outstandingCount })}
          emptyHint={t("dashboard.tiles.outstandingEmptyHint")}
          isEmpty={receivables.outstandingCount === 0}
          action={{ label: t("dashboard.tiles.outstandingAction"), href: "/invoices" }}
        />
        <DashboardMoneyTile
          icon="TriangleAlert"
          label={t("dashboard.tiles.overdue")}
          cents={receivables.overdueCents}
          currency={currency}
          locale={locale}
          hint={t("dashboard.tiles.overdueHint", { count: receivables.overdueCount })}
          emptyHint={t("dashboard.tiles.overdueEmptyHint")}
          isEmpty={receivables.overdueCount === 0}
        />
        <DashboardMoneyTile
          icon="Receipt"
          label={t("dashboard.tiles.expenses")}
          cents={expenses.periodCents}
          currency={currency}
          locale={locale}
          hint={t("dashboard.tiles.expensesHint", { count: expenses.count })}
          emptyHint={t("dashboard.tiles.expensesEmptyHint")}
          isEmpty={!hasExpenses}
          action={{ label: t("dashboard.tiles.expensesAction"), href: "/expenses" }}
        />
        <DashboardMoneyTile
          icon="TrendingUp"
          label={t("dashboard.tiles.profit")}
          cents={data.profitEstimateCents}
          currency={currency}
          locale={locale}
          hint={t("dashboard.tiles.profitHint")}
          emptyHint={t("dashboard.tiles.profitEmptyHint")}
          isEmpty={!hasRevenue && !hasExpenses}
        />
      </div>
      {data.otherCurrencyCount > 0 ? (
        <Typography affects={["muted", "small"]}>
          {t("dashboard.currencyNote", { currency, count: data.otherCurrencyCount })}
        </Typography>
      ) : null}
    </div>
  )
}

export { DashboardSummaryBand }
