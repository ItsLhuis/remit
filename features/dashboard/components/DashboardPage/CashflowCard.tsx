"use client"

import dynamic from "next/dynamic"

import { useTranslation } from "@/lib/i18n"

import { formatCurrency, formatMonthShort } from "@/lib/utils"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui"

import { type CashflowPoint } from "../../services"

import { DashboardCardEmpty } from "./DashboardCardEmpty"
import { DashboardHint } from "./DashboardHint"

const CashflowChart = dynamic(() => import("./charts").then((module) => module.CashflowChart), {
  ssr: false
})

type CashflowCardProps = {
  data: CashflowPoint[]
  locale: string
  currency: string
}

const CashflowCard = ({ data, locale, currency }: CashflowCardProps) => {
  const { t } = useTranslation()

  const hasCashflow = data.some((point) => point.revenueCents > 0 || point.expenseCents > 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          {t("dashboard.cashflow.title")}
          <DashboardHint label={t("dashboard.periods.fixedWindow")} />
        </CardTitle>
        <CardDescription>{t("dashboard.cashflow.description", { currency })}</CardDescription>
      </CardHeader>
      <CardContent className="min-w-0">
        {hasCashflow ? (
          <CashflowChart
            data={data}
            locale={locale}
            currency={currency}
            revenueLabel={t("dashboard.cashflow.revenueSeries")}
            expenseLabel={t("dashboard.cashflow.expenseSeries")}
            netLabel={t("dashboard.cashflow.netSeries")}
          />
        ) : (
          <DashboardCardEmpty
            icon="ChartColumn"
            title={t("dashboard.cashflow.emptyTitle")}
            description={t("dashboard.cashflow.emptyDescription")}
            action={{ label: t("dashboard.cashflow.emptyAction"), href: "/invoices" }}
          />
        )}
        {hasCashflow ? (
          <div className="sr-only">
            <Table>
              <TableCaption>{t("dashboard.cashflow.tableCaption")}</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("dashboard.cashflow.monthColumn")}</TableHead>
                  <TableHead>{t("dashboard.cashflow.revenueColumn")}</TableHead>
                  <TableHead>{t("dashboard.cashflow.expenseColumn")}</TableHead>
                  <TableHead>{t("dashboard.cashflow.netSeries")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((point) => (
                  <TableRow key={point.month}>
                    <TableCell>{formatMonthShort(point.month, locale)}</TableCell>
                    <TableCell>{formatCurrency(point.revenueCents, currency, locale)}</TableCell>
                    <TableCell>{formatCurrency(point.expenseCents, currency, locale)}</TableCell>
                    <TableCell>
                      {formatCurrency(point.revenueCents - point.expenseCents, currency, locale)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

export { CashflowCard }
