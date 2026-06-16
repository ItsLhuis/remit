"use client"

import { useMemo, useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import { useTranslation } from "@/lib/i18n"

import { exportTableToCsv } from "@/lib/utils"

import { useDataTable, type ColumnDef } from "@/hooks"

import {
  Badge,
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  DataTable,
  DataTableFacetedFilter,
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

import { useLeadListState } from "../../hooks"
import { softDeleteLead } from "../../mutations"
import { type LeadStatusFilter } from "../../schemas"
import { type LeadListItem, type LeadListPageData } from "../../types"

import { LeadFormSheet } from "../LeadFormSheet"

import { LeadsSummaryBand } from "./LeadsSummaryBand"
import { getLeadColumns } from "./columns"

function asStatusFilter(value: string): LeadStatusFilter {
  return value === "deleted" || value === "all" ? value : "active"
}

type LeadsListPageProps = {
  data: LeadListPageData
}

const LeadsListPage = ({ data }: LeadsListPageProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [isPending, startTransition] = useTransition()

  const { search, setSearch, status, setStatus } = useLeadListState(startTransition)

  const [createOpen, setCreateOpen] = useState(false)
  const [deleteIds, setDeleteIds] = useState<string[]>([])
  const [isBulkDeleting, startBulkDelete] = useTransition()

  const locale = data.defaults.defaultLocale

  const columns = useMemo<ColumnDef<LeadListItem>[]>(
    () => getLeadColumns(t, locale, setDeleteIds),
    [t, locale]
  )

  const { table } = useDataTable({
    data: data.leads,
    columns,
    getRowId: (lead) => lead.id,
    rowCount: data.rowCount,
    shallow: false,
    startTransition,
    columnVisibilityStorageKey: "leads:column-visibility",
    pageSizeStorageKey: "leads:page-size",
    enableRowSelection: (row) => !row.original.deletedAt
  })

  const stageColumn = table.getColumn("stage")

  const columnFiltersActive = table.getState().columnFilters.length > 0
  const hasActiveFilters = search !== "" || status !== "active" || columnFiltersActive
  const hasNoLeads = data.rowCount === 0 && !hasActiveFilters

  const activeFilterCount = table.getState().columnFilters.length + (status !== "active" ? 1 : 0)

  const reset = () => {
    void setSearch("")

    setStatus("active")

    table.resetColumnFilters()
  }

  const onConfirmDelete = () => {
    if (isBulkDeleting) return

    startBulkDelete(async () => {
      const results = await Promise.all(deleteIds.map((id) => softDeleteLead({ id })))
      const failed = results.find((result) => "error" in result)

      if (failed && "error" in failed) {
        toast.error(failed.error)

        return
      }

      toast.success(t("leads.delete.deleted"))

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
                name="Target"
                className="text-muted-foreground size-6 shrink-0"
                aria-hidden="true"
              />
              <Typography variant="h2">{t("leads.list.title")}</Typography>
            </div>
            <Typography variant="p" affects={["muted", "removePMargin"]}>
              {t("leads.list.description")}
            </Typography>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Icon name="Plus" aria-hidden="true" />
            {t("leads.actions.create")}
          </Button>
        </header>
        <LeadsSummaryBand summary={data.summary} locale={locale} />
        <DataTable
          table={table}
          caption={t("leads.list.tableTitle")}
          onRowClick={(lead) => {
            if (!lead.deletedAt) router.push(`/leads/${lead.id}`)
          }}
          getRowClassName={(lead) => (lead.deletedAt ? "opacity-50 !cursor-default" : "")}
          isLoading={isPending}
          actionBar={({ selectedRows }) => (
            <Button
              variant="destructive"
              size="sm"
              disabled={isBulkDeleting}
              onClick={() => setDeleteIds(selectedRows.map((lead) => lead.id))}
            >
              <Icon name="Trash2" aria-hidden="true" />
              {t("leads.list.bulkDelete")} ({selectedRows.length})
            </Button>
          )}
          empty={
            hasNoLeads ? (
              <Empty className="border-0 py-12">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Icon name="Target" />
                  </EmptyMedia>
                  <EmptyTitle>{t("leads.list.emptyTitle")}</EmptyTitle>
                  <EmptyDescription>{t("leads.list.emptyDescription")}</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button onClick={() => setCreateOpen(true)}>
                    <Icon name="Plus" aria-hidden="true" />
                    {t("leads.actions.create")}
                  </Button>
                </EmptyContent>
              </Empty>
            ) : (
              <Empty className="border-0 py-12">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Icon name="SearchX" />
                  </EmptyMedia>
                  <EmptyTitle>{t("leads.list.noMatchTitle")}</EmptyTitle>
                  <EmptyDescription>{t("leads.list.noMatchDescription")}</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button variant="outline" onClick={reset}>
                    {t("leads.filters.reset")}
                  </Button>
                </EmptyContent>
              </Empty>
            )
          }
        >
          <Collapsible defaultOpen={columnFiltersActive} className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-0.5">
                <Typography affects={["small", "medium"]}>{t("leads.list.tableTitle")}</Typography>
                <Typography affects={["muted", "tiny"]}>
                  {t("leads.list.count", { count: data.rowCount })}
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
                    placeholder={t("leads.filters.searchPlaceholder")}
                    aria-label={t("leads.filters.search")}
                    autoComplete="off"
                    className="pl-8"
                  />
                </div>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Icon name="ListFilter" aria-hidden="true" />
                    {t("leads.filters.title")}
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
                  onClick={() => exportTableToCsv(table, { filename: "leads" })}
                >
                  <Icon name="Download" aria-hidden="true" />
                  {t("common.table.export")}
                </Button>
                <DataTableViewOptions table={table} />
              </div>
            </div>
            <CollapsibleContent className="overflow-hidden">
              <div className="flex w-full flex-wrap items-center justify-end gap-2 border-t pt-3">
                <Select value={status} onValueChange={(value) => setStatus(asStatusFilter(value))}>
                  <SelectTrigger size="sm" className="w-32" aria-label={t("leads.filters.status")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="active">{t("leads.statusFilter.active")}</SelectItem>
                      <SelectItem value="deleted">{t("leads.statusFilter.deleted")}</SelectItem>
                      <SelectItem value="all">{t("leads.statusFilter.all")}</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {stageColumn ? (
                  <DataTableFacetedFilter column={stageColumn} title={t("leads.fields.status")} />
                ) : null}
                {hasActiveFilters ? (
                  <Button variant="ghost" size="sm" onClick={reset}>
                    <Icon name="X" aria-hidden="true" />
                    {t("leads.filters.reset")}
                  </Button>
                ) : null}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </DataTable>
        <LeadFormSheet
          mode="create"
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSuccess={(lead) => {
            setCreateOpen(false)

            router.push(`/leads/${lead.id}`)
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
              <DialogTitle>{t("leads.delete.title")}</DialogTitle>
              <DialogDescription>
                {t("leads.list.bulkDelete")} ({deleteIds.length})
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
                {t("leads.delete.confirm")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ScrollArea>
  )
}

export { LeadsListPage }
