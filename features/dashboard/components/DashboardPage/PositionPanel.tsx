"use client"

import Link from "next/link"

import { useTranslation } from "@/lib/i18n"

import { formatCurrency } from "@/lib/utils"

import { Badge, Button, Card, CardContent, Icon, Separator, Typography } from "@/components/ui"

import { type ReceivablesAging } from "../../services"
import { type DashboardReceivables } from "../../types"

import { AgingBar } from "./AgingBar"
import { DashboardCardEmpty } from "./DashboardCardEmpty"

type PositionPanelProps = {
  receivables: DashboardReceivables
  aging: ReceivablesAging
  currency: string
  locale: string
}

// The star of the page: the one figure that changes what the reader does next. Banked revenue is
// retrospective and sits a tier below; what is owed is the number a freelancer opens this app to
// check. It is the only display-scale figure on the screen, which is what makes the rest of the page
// readable as secondary.
//
// The split is a container query, not a viewport one: the panel is full-bleed today but the
// breakpoint that matters is how wide the panel itself is, so it keeps behaving if it is ever moved
// into a column. The hero steps down a size on a narrow container rather than overflowing, and can
// wrap as a last resort, because silently truncating a currency is the one failure a money tool
// cannot ship.
const PositionPanel = ({ receivables, aging, currency, locale }: PositionPanelProps) => {
  const { t } = useTranslation()

  if (receivables.outstandingCount === 0) {
    return (
      <Card>
        <CardContent>
          <DashboardCardEmpty
            icon="CircleCheck"
            title={t("dashboard.position.emptyTitle")}
            description={t("dashboard.position.emptyDescription")}
            action={{ label: t("dashboard.position.emptyAction"), href: "/invoices" }}
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="@container/position grid gap-6 @3xl/position:grid-cols-12 @3xl/position:gap-8">
        <div className="flex min-w-0 flex-col gap-4 @3xl/position:col-span-5">
          <div className="flex min-w-0 flex-col gap-1">
            <Typography affects={["muted", "small", "medium"]}>
              {t("dashboard.position.label")}
            </Typography>
            <span
              className="font-mono text-3xl leading-none font-semibold tracking-tight break-words tabular-nums @xs/position:text-4xl"
              title={formatCurrency(receivables.outstandingCents, currency, locale)}
            >
              {formatCurrency(receivables.outstandingCents, currency, locale)}
            </span>
            <Typography affects={["muted", "tiny"]}>
              {t("dashboard.position.hint", { count: receivables.outstandingCount })}
            </Typography>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {receivables.overdueCount > 0 ? (
              <Badge variant="destructive">
                <Icon name="TriangleAlert" aria-hidden="true" />
                {t("dashboard.position.overdueLabel")}
              </Badge>
            ) : (
              <Badge variant="success">
                <Icon name="CircleCheck" aria-hidden="true" />
                {t("dashboard.position.overdueNone")}
              </Badge>
            )}
            {receivables.overdueCount > 0 ? (
              <span className="font-mono text-sm tabular-nums">
                {formatCurrency(receivables.overdueCents, currency, locale)}
              </span>
            ) : null}
            {receivables.overdueCount > 0 ? (
              <Typography affects={["muted", "tiny"]}>
                {t("dashboard.position.overdueHint", { count: receivables.overdueCount })}
              </Typography>
            ) : null}
          </div>
          {aging.oldestDaysLate > 0 ? (
            <Typography affects={["muted", "tiny"]}>
              {t("dashboard.position.oldest", { days: aging.oldestDaysLate })}
            </Typography>
          ) : null}
          <Button asChild variant="outline" size="sm" className="mt-auto self-start">
            <Link href="/invoices">{t("dashboard.position.viewAll")}</Link>
          </Button>
        </div>
        <Separator
          orientation="vertical"
          className="hidden h-full @3xl/position:block @3xl/position:justify-self-center"
        />
        <div className="min-w-0 @3xl/position:col-span-6">
          <AgingBar aging={aging} currency={currency} locale={locale} />
        </div>
      </CardContent>
    </Card>
  )
}

export { PositionPanel }
