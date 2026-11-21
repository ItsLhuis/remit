"use client"

import dynamic from "next/dynamic"
import Link from "next/link"

import { useTranslation } from "@/lib/i18n"

import { formatCurrency } from "@/lib/utils"

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui"

import { type TopClient } from "../../services"

import { DashboardCardEmpty } from "./DashboardCardEmpty"

const TopClientsChart = dynamic(() => import("./charts").then((module) => module.TopClientsChart), {
  ssr: false
})

type TopClientsListProps = {
  clients: TopClient[]
  locale: string
  currency: string
}

// Ranking, so the chart is an ordered bar and the table beneath it carries the exact figures. Both
// are kept: the bar answers "is one client most of my income" at a glance, and the table answers
// "how much, exactly", which is the question a money tool must never make anyone squint at. The
// table is the accessible equivalent of the `aria-hidden` chart.
const TopClientsList = ({ clients, locale, currency }: TopClientsListProps) => {
  const { t } = useTranslation()

  if (clients.length === 0) {
    return (
      <DashboardCardEmpty
        icon="Users"
        title={t("dashboard.topClients.emptyTitle")}
        description={t("dashboard.topClients.emptyDescription")}
        action={{ label: t("dashboard.topClients.emptyAction"), href: "/clients" }}
      />
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <TopClientsChart
        data={clients.map((client) => ({
          clientId: client.clientId,
          name: client.name,
          revenueCents: client.revenueCents
        }))}
        locale={locale}
        currency={currency}
        revenueLabel={t("dashboard.topClients.revenueColumn")}
      />
      <Table>
        <TableCaption className="sr-only">{t("dashboard.topClients.title")}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{t("dashboard.topClients.nameColumn")}</TableHead>
            <TableHead className="text-right">{t("dashboard.topClients.revenueColumn")}</TableHead>
            <TableHead className="text-right">{t("dashboard.topClients.shareColumn")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((client) => (
            <TableRow key={client.clientId}>
              <TableCell className="max-w-40 truncate font-medium">
                <Link href={`/clients/${client.clientId}`} className="hover:underline">
                  {client.name}
                </Link>
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {formatCurrency(client.revenueCents, currency, locale)}
              </TableCell>
              <TableCell className="text-muted-foreground text-right font-mono tabular-nums">
                {t("dashboard.percentage", { value: client.sharePercentage })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export { TopClientsList }
