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

import { useDataTable, type ColumnDef } from "@/hooks"

import { useProjectListState } from "../../hooks"
import { softDeleteProject } from "../../mutations"
import { type ProjectStatusFilter } from "../../schemas"
import {
  type ProjectClientOption,
  type ProjectListItem,
  type ProjectListPageData
} from "../../types"
import { ProjectFormSheet } from "../ProjectFormSheet"

import { getProjectColumns } from "./columns"
import { ProjectsSummaryBand } from "./ProjectsSummaryBand"

function asStatusFilter(value: string): ProjectStatusFilter {
  return value === "deleted" || value === "all" ? value : "active"
}

type ProjectsListPageProps = {
  data: ProjectListPageData
  clients: ProjectClientOption[]
}

const ProjectsListPage = ({ data, clients }: ProjectsListPageProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [isPending, startTransition] = useTransition()

  const { search, setSearch, status, setStatus } = useProjectListState(startTransition)

  const [createOpen, setCreateOpen] = useState(false)
  const [deleteIds, setDeleteIds] = useState<string[]>([])
  const [isBulkDeleting, startBulkDelete] = useTransition()

  const locale = data.defaults.defaultLocale

  const columns = useMemo<ColumnDef<ProjectListItem>[]>(
    () => getProjectColumns(t, locale, setDeleteIds),
    [t, locale]
  )

  const { table } = useDataTable({
    data: data.projects,
    columns,
    getRowId: (project) => project.id,
    rowCount: data.rowCount,
    shallow: false,
    startTransition,
    columnVisibilityStorageKey: "projects:column-visibility",
    pageSizeStorageKey: "projects:page-size",
    enableRowSelection: (row) => !row.original.deletedAt
  })

  const stageColumn = table.getColumn("stage")

  const columnFiltersActive = table.getState().columnFilters.length > 0
  const hasActiveFilters = search !== "" || status !== "active" || columnFiltersActive
  const hasNoProjects = data.rowCount === 0 && !hasActiveFilters

  const activeFilterCount = table.getState().columnFilters.length + (status !== "active" ? 1 : 0)

  const reset = () => {
    void setSearch("")

    setStatus("active")

    table.resetColumnFilters()
  }

  const onConfirmDelete = () => {
    if (isBulkDeleting) return

    startBulkDelete(async () => {
      const results = await Promise.all(deleteIds.map((id) => softDeleteProject({ id })))
      const failed = results.find((result) => "error" in result)

      if (failed && "error" in failed) {
        toast.error(failed.error)

        return
      }

      toast.success(t("projects.delete.deleted"))

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
                name="FolderOpen"
                className="text-muted-foreground size-6 shrink-0"
                aria-hidden="true"
              />
              <Typography variant="h2">{t("projects.list.title")}</Typography>
            </div>
            <Typography variant="p" affects={["muted", "removePMargin"]}>
              {t("projects.list.description")}
            </Typography>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Icon name="Plus" aria-hidden="true" />
            {t("projects.actions.create")}
          </Button>
        </header>
        <ProjectsSummaryBand summary={data.summary} locale={locale} />
        <DataTable
          table={table}
          caption={t("projects.list.tableTitle")}
          onRowClick={(project) => {
            if (!project.deletedAt) router.push(`/projects/${project.id}`)
          }}
          getRowClassName={(project) => (project.deletedAt ? "opacity-50 !cursor-default" : "")}
          isLoading={isPending}
          actionBar={({ selectedRows }) => (
            <Button
              variant="destructive"
              size="sm"
              disabled={isBulkDeleting}
              onClick={() => setDeleteIds(selectedRows.map((project) => project.id))}
            >
              <Icon name="Trash2" aria-hidden="true" />
              {t("projects.list.bulkDelete")} ({selectedRows.length})
            </Button>
          )}
          empty={
            hasNoProjects ? (
              <Empty className="border-0 py-12">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Icon name="FolderOpen" />
                  </EmptyMedia>
                  <EmptyTitle>{t("projects.list.emptyTitle")}</EmptyTitle>
                  <EmptyDescription>{t("projects.list.emptyDescription")}</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button onClick={() => setCreateOpen(true)}>
                    <Icon name="Plus" aria-hidden="true" />
                    {t("projects.actions.create")}
                  </Button>
                </EmptyContent>
              </Empty>
            ) : (
              <Empty className="border-0 py-12">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Icon name="SearchX" />
                  </EmptyMedia>
                  <EmptyTitle>{t("projects.list.noMatchTitle")}</EmptyTitle>
                  <EmptyDescription>{t("projects.list.noMatchDescription")}</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button variant="outline" onClick={reset}>
                    {t("projects.filters.reset")}
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
                  {t("projects.list.tableTitle")}
                </Typography>
                <Typography affects={["muted", "tiny"]}>
                  {t("projects.list.count", { count: data.rowCount })}
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
                    placeholder={t("projects.filters.searchPlaceholder")}
                    aria-label={t("projects.filters.search")}
                    autoComplete="off"
                    className="pl-8"
                  />
                </div>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Icon name="ListFilter" aria-hidden="true" />
                    {t("projects.filters.title")}
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
                  onClick={() => exportTableToCsv(table, { filename: "projects" })}
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
                  <SelectTrigger
                    size="sm"
                    className="w-32"
                    aria-label={t("projects.filters.status")}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="active">{t("projects.statusFilter.active")}</SelectItem>
                      <SelectItem value="deleted">{t("projects.statusFilter.deleted")}</SelectItem>
                      <SelectItem value="all">{t("projects.statusFilter.all")}</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {stageColumn ? (
                  <DataTableFacetedFilter
                    column={stageColumn}
                    title={t("projects.fields.status")}
                  />
                ) : null}
                {hasActiveFilters ? (
                  <Button variant="ghost" size="sm" onClick={reset}>
                    <Icon name="X" aria-hidden="true" />
                    {t("projects.filters.reset")}
                  </Button>
                ) : null}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </DataTable>
        <ProjectFormSheet
          mode="create"
          clients={clients}
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSuccess={(project) => {
            setCreateOpen(false)

            router.push(`/projects/${project.id}`)
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
              <DialogTitle>{t("projects.delete.title")}</DialogTitle>
              <DialogDescription>
                {t("projects.list.bulkDelete")} ({deleteIds.length})
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
                {t("projects.delete.confirm")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ScrollArea>
  )
}

export { ProjectsListPage }
