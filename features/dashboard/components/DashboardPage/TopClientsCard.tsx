"use client"

import Link from "next/link"

import { useTranslation } from "@/lib/i18n"

import { formatCurrency, formatPercentage } from "@/lib/utils"

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

import { type TopClient } from "../../services"

import { DashboardCardEmpty } from "./DashboardCardEmpty"

type TopClientsCardProps = {
  clients: TopClient[]
  locale: string
  currency: string
}

const TopClientsCard = ({ clients, locale, currency }: TopClientsCardProps) => {
  const { t } = useTranslation()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("dashboard.topClients.title")}</CardTitle>
        <CardDescription>{t("dashboard.topClients.description", { currency })}</CardDescription>
      </CardHeader>
      <CardContent>
        {clients.length > 0 ? (
          <Table>
            <TableCaption className="sr-only">{t("dashboard.topClients.title")}</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>{t("dashboard.topClients.nameColumn")}</TableHead>
                <TableHead className="text-right">
                  {t("dashboard.topClients.revenueColumn")}
                </TableHead>
                <TableHead className="text-right">
                  {t("dashboard.topClients.shareColumn")}
                </TableHead>
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
                    {t("dashboard.topClients.share", {
                      value: formatPercentage(client.sharePercentage, locale)
                    })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <DashboardCardEmpty
            icon="Users"
            title={t("dashboard.topClients.emptyTitle")}
            description={t("dashboard.topClients.emptyDescription")}
            action={{ label: t("dashboard.topClients.emptyAction"), href: "/clients" }}
          />
        )}
      </CardContent>
    </Card>
  )
}

export { TopClientsCard }
