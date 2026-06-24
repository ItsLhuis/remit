"use client"

import { useMemo, useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import { useTranslation } from "@/lib/i18n"

import { exportTableToCsv } from "@/lib/utils"

import {
  Badge,
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  DataTable,
  DataTableDateFilter,
  DataTableFacetedFilter,
  DataTableRangeFilter,
  DataTableViewOptions,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Icon,
  Input,
  ScrollArea,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SidebarTrigger,
  Spinner,
  Typography,
  toast
} from "@/components/ui"

import { useDataTable, type ColumnDef } from "@/hooks"

import { useClientListState } from "../../hooks"
import { softDeleteClient } from "../../mutations"
import { type ClientListItem, type ClientListPageData } from "../../types"
import { ClientFormSheet } from "../ClientFormSheet"

import { ClientsSummaryBand } from "./ClientsSummaryBand"
import { getClientColumns } from "./columns"

type ClientStatusFilterValue = "active" | "deleted" | "all"

function asStatus(value: string): ClientStatusFilterValue {
  return value === "deleted" || value === "all" ? value : "active"
}

type ClientsListPageProps = {
  data: ClientListPageData
}

const ClientsListPage = ({ data }: ClientsListPageProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [isPending, startTransition] = useTransition()

  const { search, setSearch, status, setStatus } = useClientListState(startTransition)

  const [createOpen, setCreateOpen] = useState(false)
  const [deleteIds, setDeleteIds] = useState<string[]>([])
  const [isBulkDeleting, startBulkDelete] = useTransition()

  const locale = data.defaults.defaultLocale

  const columns = useMemo<ColumnDef<ClientListItem>[]>(() => {
    const currencyOptions = data.filterOptions.currencies.map((value) => ({ label: value, value }))

    return getClientColumns(t, locale, currencyOptions, setDeleteIds)
  }, [t, locale, data.filterOptions.currencies])

  const { table } = useDataTable({
    data: data.clients,
    columns,
    getRowId: (client) => client.id,
    rowCount: data.rowCount,
    shallow: false,
    startTransition,
    columnVisibilityStorageKey: "clients:column-visibility",
    enableRowSelection: (row) => !row.original.deletedAt,
    initialState: { sorting: [{ id: "name", desc: false }] }
  })

  const healthColumn = table.getColumn("health")
  const currencyColumn = table.getColumn("currency")
  const joinedColumn = table.getColumn("joined")
  const outstandingColumn = table.getColumn("outstanding")

  const columnFiltersActive = table.getState().columnFilters.length > 0
  const hasActiveFilters = search !== "" || status !== "active" || columnFiltersActive
  const hasNoClients = data.rowCount === 0 && !hasActiveFilters

  const activeFilterCount = table.getState().columnFilters.length + (status !== "active" ? 1 : 0)

  const reset = () => {
    void setSearch("")

    setStatus("active")

    table.resetColumnFilters()
  }

  const onConfirmDelete = () => {
    if (isBulkDeleting) return

    startBulkDelete(async () => {
      const results = await Promise.all(deleteIds.map((id) => softDeleteClient({ id })))
      const failed = results.find((result) => "error" in result)

      if (failed && "error" in failed) {
        toast.error(failed.error)

        return
      }

      toast.success(t("clients.delete.deleted"))

      setDeleteIds([])

      table.resetRowSelection()

      router.refresh()
    })
  }

  return (
    <ScrollArea className="size-full">
      <div className="flex w-full flex-col gap-6 p-4 md:p-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="md:hidden" />
              <Icon
                name="Users"
                className="text-muted-foreground size-6 shrink-0"
                aria-hidden="true"
              />
              <Typography variant="h2">{t("clients.list.title")}</Typography>
            </div>
            <Typography variant="p" affects={["muted", "removePMargin"]}>
              {t("clients.list.description")}
            </Typography>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Icon name="Plus" aria-hidden="true" />
            {t("clients.actions.create")}
          </Button>
        </header>
        <ClientsSummaryBand
          summary={data.summary}
          locale={locale}
          defaultCurrency={data.defaults.defaultCurrency}
        />
        <DataTable
          table={table}
          caption={t("clients.list.tableTitle")}
          onRowClick={(client) => {
            if (!client.deletedAt) router.push(`/clients/${client.id}`)
          }}
          getRowClassName={(client) => (client.deletedAt ? "opacity-50 !cursor-default" : "")}
          isLoading={isPending}
          actionBar={({ selectedRows }) => (
            <Button
              variant="destructive"
              size="sm"
              disabled={isBulkDeleting}
              onClick={() => setDeleteIds(selectedRows.map((client) => client.id))}
            >
              <Icon name="Trash2" aria-hidden="true" />
              {t("clients.list.bulkDelete")} ({selectedRows.length})
            </Button>
          )}
          empty={
            hasNoClients ? (
              <Empty className="border-0 py-12">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Icon name="Users" />
                  </EmptyMedia>
                  <EmptyTitle>{t("clients.list.emptyTitle")}</EmptyTitle>
                  <EmptyDescription>{t("clients.list.emptyDescription")}</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button onClick={() => setCreateOpen(true)}>
                    <Icon name="Plus" aria-hidden="true" />
                    {t("clients.actions.create")}
                  </Button>
                </EmptyContent>
              </Empty>
            ) : (
              <Empty className="border-0 py-12">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Icon name="SearchX" />
                  </EmptyMedia>
                  <EmptyTitle>{t("clients.list.noMatchTitle")}</EmptyTitle>
                  <EmptyDescription>{t("clients.list.noMatchDescription")}</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button variant="outline" onClick={reset}>
                    {t("clients.filters.reset")}
                  </Button>
                </EmptyContent>
              </Empty>
            )
          }
        >
          <Collapsible defaultOpen={columnFiltersActive} className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-0.5">
                <Typography affects={["small", "medium"]}>
                  {t("clients.list.tableTitle")}
                </Typography>
                <Typography affects={["muted", "tiny"]}>
                  {t("clients.list.count", { count: data.rowCount })}
                </Typography>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <div className="relative w-full sm:w-64">
                  <Icon
                    name="Search"
                    className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
                    aria-hidden="true"
                  />
                  <Input
                    value={search}
                    onChange={(event) => void setSearch(event.target.value)}
                    placeholder={t("clients.filters.searchPlaceholder")}
                    aria-label={t("clients.filters.search")}
                    autoComplete="off"
                    className="pl-8"
                  />
                </div>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Icon name="ListFilter" aria-hidden="true" />
                    {t("clients.filters.title")}
                    {activeFilterCount > 0 ? (
                      <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                        {activeFilterCount}
                      </Badge>
                    ) : null}
                  </Button>
                </CollapsibleTrigger>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportTableToCsv(table, { filename: "clients" })}
                >
                  <Icon name="Download" aria-hidden="true" />
                  {t("common.table.export")}
                </Button>
                <DataTableViewOptions table={table} />
              </div>
            </div>
            <CollapsibleContent className="overflow-hidden">
              <div className="flex w-full flex-wrap items-center justify-end gap-2 border-t pt-3">
                <Select value={status} onValueChange={(value) => setStatus(asStatus(value))}>
                  <SelectTrigger
                    size="sm"
                    className="w-32"
                    aria-label={t("clients.filters.status")}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="active">{t("clients.status.active")}</SelectItem>
                      <SelectItem value="deleted">{t("clients.status.deleted")}</SelectItem>
                      <SelectItem value="all">{t("clients.status.all")}</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {healthColumn ? (
                  <DataTableFacetedFilter
                    column={healthColumn}
                    title={t("clients.list.healthColumn")}
                  />
                ) : null}
                {currencyColumn && data.filterOptions.currencies.length > 0 ? (
                  <DataTableFacetedFilter
                    column={currencyColumn}
                    title={t("clients.fields.currency")}
                  />
                ) : null}
                {outstandingColumn ? (
                  <DataTableRangeFilter
                    column={outstandingColumn}
                    title={t("clients.list.outstandingBalance")}
                  />
                ) : null}
                {joinedColumn ? (
                  <DataTableDateFilter column={joinedColumn} title={t("clients.list.joined")} />
                ) : null}
                {hasActiveFilters ? (
                  <Button variant="ghost" size="sm" onClick={reset}>
                    <Icon name="X" aria-hidden="true" />
                    {t("clients.filters.reset")}
                  </Button>
                ) : null}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </DataTable>
        <ClientFormSheet
          mode="create"
          defaultCurrency={data.defaults.defaultCurrency}
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSuccess={(client) => {
            setCreateOpen(false)

            router.push(`/clients/${client.id}`)
            router.refresh()
          }}
        />
        <Dialog
          open={deleteIds.length > 0}
          onOpenChange={(open) => {
            if (!open && !isBulkDeleting) setDeleteIds([])
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("clients.delete.title")}</DialogTitle>
              <DialogDescription>
                {t("clients.list.bulkDelete")} ({deleteIds.length})
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isBulkDeleting}>
                  {t("common.actions.cancel")}
                </Button>
              </DialogClose>
              <Button
                type="button"
                variant="destructive"
                disabled={isBulkDeleting}
                onClick={onConfirmDelete}
              >
                {isBulkDeleting ? <Spinner /> : null}
                {t("clients.delete.confirm")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ScrollArea>
  )
}

export { ClientsListPage }
