"use client"

import { useTransition } from "react"

import { useTranslation } from "@/lib/i18n"

import { SidebarTrigger, Typography } from "@/components/ui"

import { type DashboardPageData } from "../../types"

import { CashflowCard } from "./CashflowCard"
import { DashboardPeriodSelect } from "./DashboardPeriodSelect"
import { DashboardSummaryBand } from "./DashboardSummaryBand"
import { RecentActivityCard } from "./RecentActivityCard"
import { TopClientsCard } from "./TopClientsCard"
import { UpcomingInvoicesCard } from "./UpcomingInvoicesCard"

type DashboardPageProps = {
  data: DashboardPageData
}

const DashboardPage = ({ data }: DashboardPageProps) => {
  const { t } = useTranslation()

  const [isPending, startTransition] = useTransition()

  const locale = data.defaults.defaultLocale

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <header className="flex flex-wrap items-center gap-2">
        <SidebarTrigger className="md:hidden" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Typography variant="h2">{t("dashboard.title")}</Typography>
          <Typography affects={["muted", "small", "removePMargin"]}>
            {t("dashboard.description")}
          </Typography>
        </div>
        <DashboardPeriodSelect isPending={isPending} startTransition={startTransition} />
      </header>
      <DashboardSummaryBand data={data} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <CashflowCard data={data.cashflow} locale={locale} currency={data.currency} />
        <UpcomingInvoicesCard invoices={data.upcomingInvoices} locale={locale} />
        <TopClientsCard clients={data.topClients} locale={locale} currency={data.currency} />
        <RecentActivityCard
          entries={data.activity}
          locale={locale}
          timeZone={data.defaults.defaultTimezone}
        />
      </div>
    </div>
  )
}

export { DashboardPage }
