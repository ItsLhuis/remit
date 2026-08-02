"use client"

import { useMemo, useTransition } from "react"

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

import { useInvoiceOverviewState } from "../../hooks"
import { type InvoiceOverviewItem, type InvoiceOverviewPageData } from "../../types"
import { InvoicesSummaryBand } from "../InvoicesSummaryBand"

import { getInvoiceOverviewColumns } from "./columns"
import { InvoicesOverviewToolbar } from "./InvoicesOverviewToolbar"

type InvoicesOverviewPageProps = {
  data: InvoiceOverviewPageData
}

const InvoicesOverviewPage = ({ data }: InvoicesOverviewPageProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [isPending, startTransition] = useTransition()

  const { search, setSearch } = useInvoiceOverviewState(startTransition)

  const locale = data.defaults.defaultLocale

  const columns = useMemo<ColumnDef<InvoiceOverviewItem>[]>(
    () => getInvoiceOverviewColumns({ t, locale, clients: data.filterOptions.clients }),
    [t, locale, data.filterOptions.clients]
  )

  const { table } = useDataTable({
    data: data.invoices,
    columns,
    getRowId: (invoice) => invoice.id,
    rowCount: data.rowCount,
    shallow: false,
    startTransition,
    columnVisibilityStorageKey: "invoices-overview:column-visibility",
    initialState: {
      sorting: [{ id: "dueDate", desc: false }],
      // `client` repeats what `parent` already shows for most rows; it stays available so the client
      // filter has a column and so the name can be revealed when `parent` names a project instead.
      columnVisibility: { client: false, issueDate: false }
    }
  })

  const hasActiveFilters = search !== "" || table.getState().columnFilters.length > 0
  const hasNoInvoices = data.rowCount === 0 && !hasActiveFilters

  const reset = () => {
    void setSearch("")

    table.resetColumnFilters()
  }

  return (
    <ScrollArea className="size-full">
      <div className="flex w-full flex-col gap-6 p-4 md:p-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="md:hidden" />
              <Icon
                name="Receipt"
                className="text-muted-foreground size-6 shrink-0"
                aria-hidden="true"
              />
              <Typography variant="h2">{t("invoices.overview.title")}</Typography>
            </div>
            <Typography variant="p" affects={["muted", "removePMargin"]}>
              {t("invoices.overview.description")}
            </Typography>
          </div>
          <Button variant="outline" asChild>
            <Link href="/projects">
              <Icon name="FolderOpen" aria-hidden="true" />
              {t("invoices.overview.browseProjects")}
            </Link>
          </Button>
        </header>
        <InvoicesSummaryBand
          summary={data.summary}
          currency={data.defaults.defaultCurrency}
          locale={locale}
          totalHint={t("invoices.overview.totalHint")}
        />
        <DataTable
          table={table}
          caption={t("invoices.overview.tableTitle")}
          onRowClick={(invoice) => {
            if (invoice.projectId) {
              router.push(`/projects/${invoice.projectId}/invoices/${invoice.id}`)
            }
          }}
          getRowClassName={(invoice) => (invoice.projectId ? "" : "!cursor-default")}
          isLoading={isPending}
          empty={
            hasNoInvoices ? (
              <Empty className="border-0 py-12">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Icon name="Receipt" />
                  </EmptyMedia>
                  <EmptyTitle>{t("invoices.overview.emptyTitle")}</EmptyTitle>
                  <EmptyDescription>{t("invoices.overview.emptyDescription")}</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button asChild>
                    <Link href="/projects">
                      <Icon name="FolderOpen" aria-hidden="true" />
                      {t("invoices.overview.browseProjects")}
                    </Link>
                  </Button>
                </EmptyContent>
              </Empty>
            ) : (
              <Empty className="border-0 py-12">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Icon name="SearchX" />
                  </EmptyMedia>
                  <EmptyTitle>{t("invoices.overview.noMatchTitle")}</EmptyTitle>
                  <EmptyDescription>{t("invoices.overview.noMatchDescription")}</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button variant="outline" onClick={reset}>
                    {t("invoices.list.clearFilters")}
                  </Button>
                </EmptyContent>
              </Empty>
            )
          }
        >
          <InvoicesOverviewToolbar
            table={table}
            rowCount={data.rowCount}
            search={search}
            onSearchChange={setSearch}
            onReset={reset}
            hasClientOptions={data.filterOptions.clients.length > 0}
          />
        </DataTable>
      </div>
    </ScrollArea>
  )
}

export { InvoicesOverviewPage }
