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
    <Card className="xl:col-span-2">
      <CardHeader>
        <CardTitle>{t("dashboard.cashflow.title")}</CardTitle>
        <CardDescription>{t("dashboard.cashflow.description", { currency })}</CardDescription>
      </CardHeader>
      <CardContent>
        {hasCashflow ? (
          <CashflowChart
            data={data}
            locale={locale}
            currency={currency}
            revenueLabel={t("dashboard.cashflow.revenueSeries")}
            expenseLabel={t("dashboard.cashflow.expenseSeries")}
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((point) => (
                  <TableRow key={point.month}>
                    <TableCell>{formatMonthShort(point.month, locale)}</TableCell>
                    <TableCell>{formatCurrency(point.revenueCents, currency, locale)}</TableCell>
                    <TableCell>{formatCurrency(point.expenseCents, currency, locale)}</TableCell>
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
