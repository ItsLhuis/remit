"use client"

import { useMemo, useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import Link from "next/link"

import { useTranslation } from "@/lib/i18n"

import {
  Button,
  DataTable,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Icon,
  ScrollArea,
  SidebarTrigger,
  Typography
} from "@/components/ui"

import { useDataTable, type ColumnDef } from "@/hooks"

import { useRecurringInvoiceOverviewState } from "../../hooks"
import { RECURRING_INVOICE_DEFAULT_SORT } from "../../schemas"
import { type RecurringInvoiceListItem, type RecurringInvoiceListPageData } from "../../types"
import { CancelRecurringInvoiceDialog } from "../CancelRecurringInvoiceDialog"
import { DeleteRecurringInvoiceDialog } from "../DeleteRecurringInvoiceDialog"
import { PauseRecurringInvoiceDialog } from "../PauseRecurringInvoiceDialog"
import { ResumeRecurringInvoiceDialog } from "../ResumeRecurringInvoiceDialog"

import { getRecurringInvoiceOverviewColumns, type RecurringInvoiceRowActionTarget } from "./columns"
import { RecurringInvoicesOverviewToolbar } from "./RecurringInvoicesOverviewToolbar"

type RecurringInvoicesOverviewPageProps = {
  data: RecurringInvoiceListPageData
}

const RecurringInvoicesOverviewPage = ({ data }: RecurringInvoicesOverviewPageProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [rowAction, setRowAction] = useState<RecurringInvoiceRowActionTarget | null>(null)
  const [isPending, startTransition] = useTransition()

  const { search, setSearch } = useRecurringInvoiceOverviewState(startTransition)

  const locale = data.defaults.defaultLocale
  const timeZone = data.defaults.defaultTimezone

  const columns = useMemo<ColumnDef<RecurringInvoiceListItem>[]>(
    () =>
      getRecurringInvoiceOverviewColumns({
        t,
        locale,
        timeZone,
        clients: data.clientOptions,
        onAction: setRowAction
      }),
    [t, locale, timeZone, data.clientOptions]
  )

  const { table } = useDataTable({
    data: data.rows,
    columns,
    getRowId: (schedule) => schedule.id,
    rowCount: data.rowCount,
    shallow: false,
    startTransition,
    columnVisibilityStorageKey: "recurring-invoices-overview:column-visibility",
    // Kept in step with the server's own default so the first render and an explicit sort of the
    // same column produce the same order; `RECURRING_INVOICE_DEFAULT_SORT` is what
    // `parseRecurringInvoiceOverviewQuery` falls back to when the URL carries no sort.
    initialState: { sorting: [...RECURRING_INVOICE_DEFAULT_SORT] }
  })

  const hasActiveFilters = search !== "" || table.getState().columnFilters.length > 0

  const createHref = "/recurring-invoices/new"

  const reset = () => {
    void setSearch("")

    table.resetColumnFilters()
  }

  const closeRowAction = (open: boolean) => {
    if (!open) setRowAction(null)
  }

  return (
    <ScrollArea className="size-full">
      <div className="flex w-full flex-col gap-6 p-4 md:p-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="md:hidden" />
              <Icon
                name="Repeat"
                className="text-muted-foreground size-6 shrink-0"
                aria-hidden="true"
              />
              <Typography variant="h2">{t("recurringInvoices.list.title")}</Typography>
            </div>
            <Typography variant="p" affects={["muted", "removePMargin"]}>
              {t("recurringInvoices.list.description")}
            </Typography>
          </div>
          <Button asChild>
            <Link href={createHref}>
              <Icon name="Plus" aria-hidden="true" />
              {t("recurringInvoices.list.createButton")}
            </Link>
          </Button>
        </header>
        <DataTable
          table={table}
          caption={t("recurringInvoices.list.title")}
          onRowClick={(schedule) => router.push(`/recurring-invoices/${schedule.id}`)}
          isLoading={isPending}
          empty={
            <Empty className="border-0 py-12">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Icon name={hasActiveFilters ? "SearchX" : "Repeat"} />
                </EmptyMedia>
                <EmptyTitle>{t("recurringInvoices.list.empty.title")}</EmptyTitle>
                <EmptyDescription>{t("recurringInvoices.list.empty.description")}</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                {hasActiveFilters ? (
                  <Button variant="outline" onClick={reset}>
                    {t("recurringInvoices.filters.clear")}
                  </Button>
                ) : (
                  <Button asChild>
                    <Link href={createHref}>
                      <Icon name="Plus" aria-hidden="true" />
                      {t("recurringInvoices.list.empty.action")}
                    </Link>
                  </Button>
                )}
              </EmptyContent>
            </Empty>
          }
        >
          <RecurringInvoicesOverviewToolbar
            table={table}
            search={search}
            onSearchChange={setSearch}
            onReset={reset}
            hasClientOptions={data.clientOptions.length > 0}
          />
        </DataTable>
        {rowAction?.action === "pause" ? (
          <PauseRecurringInvoiceDialog
            recurringInvoiceId={rowAction.id}
            open
            onOpenChange={closeRowAction}
          />
        ) : null}
        {rowAction?.action === "resume" ? (
          <ResumeRecurringInvoiceDialog
            recurringInvoiceId={rowAction.id}
            open
            onOpenChange={closeRowAction}
          />
        ) : null}
        {rowAction?.action === "cancel" ? (
          <CancelRecurringInvoiceDialog
            recurringInvoiceId={rowAction.id}
            open
            onOpenChange={closeRowAction}
          />
        ) : null}
        {rowAction?.action === "delete" ? (
          <DeleteRecurringInvoiceDialog
            recurringInvoiceId={rowAction.id}
            open
            onOpenChange={closeRowAction}
          />
        ) : null}
      </div>
    </ScrollArea>
  )
}

export { RecurringInvoicesOverviewPage }
