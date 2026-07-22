"use client"

import { useMemo, useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import { useTranslation } from "@/lib/i18n"

import {
  Badge,
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  DataTableFacetedFilter,
  DataTablePagination,
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

import { useDataTable } from "@/hooks"

import { useTemplateListState } from "../../hooks"
import { setDefaultTemplate, softDeleteTemplate } from "../../mutations"
import { type TemplateListItem, type TemplateListPageData } from "../../types"
import { DeleteTemplateDialog } from "../DeleteTemplateDialog"
import { TemplateFormSheet } from "../TemplateFormSheet"

import { getTemplateColumns } from "./columns"
import { TemplatesGrid } from "./TemplatesGrid"

// A card grid has no column headers to sort from, so sorting is a single explicit choice. Each
// option maps to the sorting state the data hook writes to the URL.
const TEMPLATE_SORT_OPTIONS = [
  { value: "type:asc", labelKey: "templates.sort.type", sorting: [{ id: "type", desc: false }] },
  { value: "name:asc", labelKey: "templates.sort.name", sorting: [{ id: "name", desc: false }] },
  {
    value: "updated:desc",
    labelKey: "templates.sort.updated",
    sorting: [{ id: "updated", desc: true }]
  }
] as const

const DEFAULT_SORT_VALUE = "type:asc"

const SKELETON_CARDS = 8

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
  const [deleteTarget, setDeleteTarget] = useState<TemplateListItem | null>(null)
  const [isMutating, startMutating] = useTransition()

  const locale = data.defaults.defaultLocale

  const columns = useMemo(() => getTemplateColumns(t), [t])

  const { table } = useDataTable({
    data: data.templates,
    columns,
    getRowId: (template) => template.id,
    rowCount: data.rowCount,
    shallow: false,
    startTransition,
    enableRowSelection: false,
    initialState: { sorting: [{ id: "type", desc: false }] }
  })

  const typeColumn = table.getColumn("type")

  const sorting = table.getState().sorting
  const sortValue =
    TEMPLATE_SORT_OPTIONS.find(
      (option) =>
        option.sorting[0].id === sorting[0]?.id && option.sorting[0].desc === sorting[0]?.desc
    )?.value ?? DEFAULT_SORT_VALUE

  const columnFiltersActive = table.getState().columnFilters.length > 0
  const hasActiveFilters = search !== "" || origin !== "all" || columnFiltersActive
  const hasNoTemplates = data.rowCount === 0 && !hasActiveFilters

  const activeFilterCount = table.getState().columnFilters.length + (origin !== "all" ? 1 : 0)

  const reset = () => {
    void setSearch("")

    setOrigin("all")

    table.resetColumnFilters()
  }

  const handleSort = (value: string) => {
    const option = TEMPLATE_SORT_OPTIONS.find((item) => item.value === value)

    if (option) table.setSorting([...option.sorting])
  }

  const handleSetDefault = (id: string) => {
    startMutating(async () => {
      const result = await setDefaultTemplate({ id })

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      toast.success(t("templates.actions.setDefault"))
      router.refresh()
    })
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
        <div className="ring-foreground/10 overflow-hidden rounded-xl ring-1">
          <div className="border-b p-3">
            <Collapsible defaultOpen={columnFiltersActive} className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-0.5">
                  <Typography affects={["small", "medium"]}>
                    {t("templates.list.gridTitle")}
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
                  <Select value={sortValue} onValueChange={handleSort}>
                    <SelectTrigger
                      size="sm"
                      className="w-44"
                      aria-label={t("templates.filters.sort")}
                    >
                      <Icon name="ArrowUpDown" className="text-muted-foreground" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {TEMPLATE_SORT_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {t(option.labelKey)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
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
                    <DataTableFacetedFilter
                      column={typeColumn}
                      title={t("templates.fields.type")}
                    />
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
          </div>
          <div className="p-3">
            <TemplatesGrid
              templates={data.templates}
              locale={locale}
              isLoading={isPending}
              skeletonCards={SKELETON_CARDS}
              onSetDefault={handleSetDefault}
              onDelete={setDeleteTarget}
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
            />
          </div>
          <div className="border-t p-3">
            <DataTablePagination table={table} />
          </div>
        </div>
        <TemplateFormSheet open={createOpen} onOpenChange={setCreateOpen} />
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
