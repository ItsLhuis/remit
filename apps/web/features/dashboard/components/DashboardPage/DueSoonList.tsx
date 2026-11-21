"use client"

import { useTranslation } from "@/lib/i18n"

import { formatCurrency, formatDay } from "@/lib/utils"

import {
  Badge,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui"

import { type UpcomingInvoice } from "../../services"

import { DashboardCardEmpty } from "./DashboardCardEmpty"

type DueSoonListProps = {
  invoices: UpcomingInvoice[]
  locale: string
}

// No per-invoice link: an invoice detail route is nested under its project
// (`/projects/[projectId]/invoices/[invoiceId]`), and an invoice raised straight against a client
// has no project to nest under, so half the rows would carry a link that cannot be built. The
// attention rail links the ones that do have a project, because it carries the project id.
const DueSoonList = ({ invoices, locale }: DueSoonListProps) => {
  const { t } = useTranslation()

  if (invoices.length === 0) {
    return (
      <DashboardCardEmpty
        icon="CalendarClock"
        title={t("dashboard.upcoming.emptyTitle")}
        description={t("dashboard.upcoming.emptyDescription")}
        action={{ label: t("dashboard.upcoming.emptyAction"), href: "/invoices" }}
      />
    )
  }

  return (
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
              <Tooltip>
                <TooltipTrigger type="button" className="focus-visible:outline-none">
                  <Badge variant="secondary">
                    {invoice.daysUntilDue === 0
                      ? t("dashboard.upcoming.dueToday")
                      : t("dashboard.upcoming.dueIn", { days: invoice.daysUntilDue })}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>{formatDay(invoice.dueDate, locale)}</TooltipContent>
              </Tooltip>
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums">
              {formatCurrency(invoice.receivableCents, invoice.currency, locale)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export { DueSoonList }
