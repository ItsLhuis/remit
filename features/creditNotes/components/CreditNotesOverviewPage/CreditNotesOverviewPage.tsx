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

import { useCreditNoteOverviewState } from "../../hooks"
import { type CreditNoteOverviewItem, type CreditNoteOverviewPageData } from "../../types"
import { CreditNotesSummaryBand } from "../CreditNotesSummaryBand"

import { getCreditNoteOverviewColumns } from "./columns"
import { CreditNotesOverviewToolbar } from "./CreditNotesOverviewToolbar"

type CreditNotesOverviewPageProps = {
  data: CreditNoteOverviewPageData
}

const CreditNotesOverviewPage = ({ data }: CreditNotesOverviewPageProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [isPending, startTransition] = useTransition()

  const { search, setSearch } = useCreditNoteOverviewState(startTransition)

  const locale = data.defaults.defaultLocale

  const columns = useMemo<ColumnDef<CreditNoteOverviewItem>[]>(
    () => getCreditNoteOverviewColumns({ t, locale, clients: data.filterOptions.clients }),
    [t, locale, data.filterOptions.clients]
  )

  const { table } = useDataTable({
    data: data.creditNotes,
    columns,
    getRowId: (creditNote) => creditNote.id,
    rowCount: data.rowCount,
    shallow: false,
    startTransition,
    columnVisibilityStorageKey: "credit-notes-overview:column-visibility",
    initialState: {
      sorting: [{ id: "issuedAt", desc: true }]
    }
  })

  const hasActiveFilters = search !== "" || table.getState().columnFilters.length > 0
  const hasNoCreditNotes = data.rowCount === 0 && !hasActiveFilters

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
                name="ReceiptText"
                className="text-muted-foreground size-6 shrink-0"
                aria-hidden="true"
              />
              <Typography variant="h2">{t("creditNotes.overview.title")}</Typography>
            </div>
            <Typography variant="p" affects={["muted", "removePMargin"]}>
              {t("creditNotes.overview.description")}
            </Typography>
          </div>
          <Button variant="outline" asChild>
            <Link href="/invoices">
              <Icon name="Receipt" aria-hidden="true" />
              {t("creditNotes.overview.browseInvoices")}
            </Link>
          </Button>
        </header>
        <CreditNotesSummaryBand
          summary={data.summary}
          currency={data.defaults.defaultCurrency}
          locale={locale}
        />
        <DataTable
          table={table}
          caption={t("creditNotes.overview.tableTitle")}
          onRowClick={(creditNote) => {
            if (creditNote.projectId) {
              router.push(
                `/projects/${creditNote.projectId}/invoices/${creditNote.invoiceId}/credit-notes/${creditNote.id}`
              )
            }
          }}
          getRowClassName={(creditNote) => (creditNote.projectId ? "" : "!cursor-default")}
          isLoading={isPending}
          empty={
            hasNoCreditNotes ? (
              <Empty className="border-0 py-12">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Icon name="ReceiptText" />
                  </EmptyMedia>
                  <EmptyTitle>{t("creditNotes.overview.emptyTitle")}</EmptyTitle>
                  <EmptyDescription>{t("creditNotes.overview.emptyDescription")}</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button asChild>
                    <Link href="/invoices">
                      <Icon name="Receipt" aria-hidden="true" />
                      {t("creditNotes.overview.browseInvoices")}
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
                  <EmptyTitle>{t("creditNotes.overview.noMatchTitle")}</EmptyTitle>
                  <EmptyDescription>
                    {t("creditNotes.overview.noMatchDescription")}
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button variant="outline" onClick={reset}>
                    {t("creditNotes.overview.clearFilters")}
                  </Button>
                </EmptyContent>
              </Empty>
            )
          }
        >
          <CreditNotesOverviewToolbar
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

export { CreditNotesOverviewPage }
