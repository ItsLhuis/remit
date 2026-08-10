"use client"

import Link from "next/link"

import { useTranslation } from "@/lib/i18n"

import { formatCurrency, formatDay } from "@/lib/utils"

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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

import { type UpcomingInvoice } from "../../services"

import { DashboardCardEmpty } from "./DashboardCardEmpty"

type UpcomingInvoicesCardProps = {
  invoices: UpcomingInvoice[]
  locale: string
}

// No per-invoice link: an invoice detail route is nested under its project
// (`/projects/[projectId]/invoices/[invoiceId]`), and an invoice raised straight against a client
// has no project to nest under, so half the rows would carry a link that cannot be built.
const UpcomingInvoicesCard = ({ invoices, locale }: UpcomingInvoicesCardProps) => {
  const { t } = useTranslation()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("dashboard.upcoming.title")}</CardTitle>
        <CardDescription>{t("dashboard.upcoming.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {invoices.length > 0 ? (
          <Table>
            <TableCaption className="sr-only">{t("dashboard.upcoming.title")}</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>{t("dashboard.upcoming.numberColumn")}</TableHead>
                <TableHead>{t("dashboard.upcoming.parentColumn")}</TableHead>
                <TableHead>{t("dashboard.upcoming.dueColumn")}</TableHead>
                <TableHead className="text-right">{t("dashboard.upcoming.amountColumn")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">{invoice.number}</TableCell>
                  <TableCell className="text-muted-foreground max-w-40 truncate">
                    {invoice.parentName || t("dashboard.upcoming.noParent")}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" title={formatDay(invoice.dueDate, locale)}>
                      {invoice.daysUntilDue === 0
                        ? t("dashboard.upcoming.dueToday")
                        : t("dashboard.upcoming.dueIn", { days: invoice.daysUntilDue })}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatCurrency(invoice.receivableCents, invoice.currency, locale)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <DashboardCardEmpty
            icon="CalendarClock"
            title={t("dashboard.upcoming.emptyTitle")}
            description={t("dashboard.upcoming.emptyDescription")}
            action={{ label: t("dashboard.upcoming.emptyAction"), href: "/invoices" }}
          />
        )}
      </CardContent>
      {invoices.length > 0 ? (
        <CardFooter>
          <Button asChild variant="outline" size="sm">
            <Link href="/invoices">{t("dashboard.upcoming.viewAll")}</Link>
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  )
}

export { UpcomingInvoicesCard }
