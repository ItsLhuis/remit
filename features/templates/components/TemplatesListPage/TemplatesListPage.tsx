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
  Typography,
  toast
} from "@/components/ui"

import { useDataTable, type ColumnDef } from "@/hooks"

import { useTemplateListState } from "../../hooks"
import { softDeleteTemplate } from "../../mutations"
import { type TemplateListItem, type TemplateListPageData } from "../../types"
import { DeleteTemplateDialog } from "../DeleteTemplateDialog"
import { TemplateFormSheet } from "../TemplateFormSheet"

import { getTemplateColumns } from "./columns"
import { TemplatePreviewDialog } from "./TemplatePreviewDialog"
import { TemplatesSummaryBand } from "./TemplatesSummaryBand"

type TemplatesListPageProps = {
  data: TemplateListPageData
}

const TemplatesListPage = ({ data }: TemplatesListPageProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [isPending, startTransition] = useTransition()

  const {
    search,
    setSearch,
    status: origin,
    setStatus: setOrigin
  } = useTemplateListState(startTransition)

  const [createOpen, setCreateOpen] = useState(false)
  const [previewTarget, setPreviewTarget] = useState<TemplateListItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TemplateListItem | null>(null)
  const [isMutating, startMutating] = useTransition()

  const locale = data.defaults.defaultLocale

  const columns = useMemo<ColumnDef<TemplateListItem>[]>(
    () => getTemplateColumns(t, locale, setPreviewTarget, setDeleteTarget),
    [t, locale]
  )

  const { table } = useDataTable({
    data: data.templates,
    columns,
    getRowId: (template) => template.id,
    rowCount: data.rowCount,
    shallow: false,
    startTransition,
    columnVisibilityStorageKey: "templates:column-visibility",
    enableRowSelection: false,
    initialState: { sorting: [{ id: "type", desc: false }] }
  })

  const typeColumn = table.getColumn("type")

  const columnFiltersActive = table.getState().columnFilters.length > 0
  const hasActiveFilters = search !== "" || origin !== "all" || columnFiltersActive
  const hasNoTemplates = data.rowCount === 0 && !hasActiveFilters

  const activeFilterCount = table.getState().columnFilters.length + (origin !== "all" ? 1 : 0)

  const reset = () => {
    void setSearch("")

    setOrigin("all")

    table.resetColumnFilters()
  }

  const handleConfirmDelete = () => {
    if (!deleteTarget) return

    startMutating(async () => {
      const result = await softDeleteTemplate({ id: deleteTarget.id })

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      toast.success(t("templates.actions.delete"))
      setDeleteTarget(null)
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
                name="LayoutTemplate"
                className="text-muted-foreground size-6 shrink-0"
                aria-hidden="true"
              />
              <Typography variant="h2">{t("templates.title")}</Typography>
            </div>
            <Typography variant="p" affects={["muted", "removePMargin"]}>
              {t("templates.description")}
            </Typography>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Icon name="Plus" aria-hidden="true" />
            {t("templates.actions.create")}
          </Button>
        </header>
        <TemplatesSummaryBand summary={data.summary} locale={locale} />
        <DataTable
          table={table}
          caption={t("templates.list.tableTitle")}
          onRowClick={(template) => router.push(`/templates/${template.id}`)}
          isLoading={isPending}
          empty={
            hasNoTemplates ? (
              <Empty className="border-0 py-12">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Icon name="LayoutTemplate" />
                  </EmptyMedia>
                  <EmptyTitle>{t("templates.empty.title")}</EmptyTitle>
                  <EmptyDescription>{t("templates.empty.description")}</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button onClick={() => setCreateOpen(true)}>
                    <Icon name="Plus" aria-hidden="true" />
                    {t("templates.actions.create")}
                  </Button>
                </EmptyContent>
              </Empty>
            ) : (
              <Empty className="border-0 py-12">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Icon name="SearchX" />
                  </EmptyMedia>
                  <EmptyTitle>{t("templates.list.noMatchTitle")}</EmptyTitle>
                  <EmptyDescription>{t("templates.list.noMatchDescription")}</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button variant="outline" onClick={reset}>
                    {t("templates.filters.reset")}
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
                  {t("templates.list.tableTitle")}
                </Typography>
                <Typography affects={["muted", "tiny"]}>
                  {t("templates.list.count", { count: data.rowCount })}
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
                    placeholder={t("templates.filters.searchPlaceholder")}
                    aria-label={t("templates.filters.search")}
                    autoComplete="off"
                    className="pl-8"
                  />
                </div>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Icon name="ListFilter" aria-hidden="true" />
                    {t("templates.filters.title")}
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
                  onClick={() => exportTableToCsv(table, { filename: "templates" })}
                >
                  <Icon name="Download" aria-hidden="true" />
                  {t("common.table.export")}
                </Button>
                <DataTableViewOptions table={table} />
              </div>
            </div>
            <CollapsibleContent className="overflow-hidden">
              <div className="flex w-full flex-wrap items-center justify-end gap-2 border-t pt-3">
                <Select value={origin} onValueChange={setOrigin}>
                  <SelectTrigger
                    size="sm"
                    className="w-36"
                    aria-label={t("templates.filters.origin")}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="all">{t("templates.origin.all")}</SelectItem>
                      <SelectItem value="custom">{t("templates.origin.custom")}</SelectItem>
                      <SelectItem value="system">{t("templates.origin.system")}</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {typeColumn ? (
                  <DataTableFacetedFilter column={typeColumn} title={t("templates.fields.type")} />
                ) : null}
                {hasActiveFilters ? (
                  <Button variant="ghost" size="sm" onClick={reset}>
                    <Icon name="X" aria-hidden="true" />
                    {t("templates.filters.reset")}
                  </Button>
                ) : null}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </DataTable>
        <TemplateFormSheet open={createOpen} onOpenChange={setCreateOpen} />
        <TemplatePreviewDialog
          template={previewTarget}
          onOpenChange={(open) => (open ? undefined : setPreviewTarget(null))}
        />
        <DeleteTemplateDialog
          templateName={deleteTarget?.name ?? ""}
          open={deleteTarget !== null}
          isDeleting={isMutating}
          onOpenChange={(open) => (open ? undefined : setDeleteTarget(null))}
          onConfirm={handleConfirmDelete}
        />
      </div>
    </ScrollArea>
  )
}

export { TemplatesListPage }
