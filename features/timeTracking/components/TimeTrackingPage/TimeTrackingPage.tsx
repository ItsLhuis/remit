"use client"

import { useMemo, useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import { useTranslation } from "@/lib/i18n"

import { formatCentsForInput } from "@/lib/utils"

import {
  Button,
  DataTable,
  Icon,
  ScrollArea,
  SidebarTrigger,
  Typography,
  toast
} from "@/components/ui"

import { useDataTable, type ColumnDef } from "@/hooks"

import { useTimeEntryListState } from "../../hooks"
import { softDeleteTimeEntry } from "../../mutations"
import { type TimeEntryListItem, type TimeTrackingPageData } from "../../types"
import { DeleteTimeEntryDialog } from "../DeleteTimeEntryDialog"
import { TimeEntryFormSheet } from "../TimeEntryFormSheet"

import { getTimeEntryColumns } from "./columns"
import { TimerCard } from "./TimerCard"
import { TimeTrackingEmpty } from "./TimeTrackingEmpty"
import { TimeTrackingFilters } from "./TimeTrackingFilters"
import { TimeTrackingSummaryBand } from "./TimeTrackingSummaryBand"

// The sheet is fed from the list row rather than from a fresh read: the row already carries every
// field the form binds, and `updateTimeEntry` re-validates all of them at the trust boundary. A
// still-running entry has no end and is not editable, which is what the null return encodes.
function toEditFormData(entry: TimeEntryListItem | null) {
  if (!entry?.endedAt) return null

  return {
    id: entry.id,
    projectId: entry.projectId,
    taskId: entry.taskId ?? "",
    description: entry.description,
    startedAt: entry.startedAt.toISOString(),
    endedAt: entry.endedAt.toISOString(),
    billable: entry.billable,
    hourlyRate: formatCentsForInput(entry.hourlyRateOverrideCents)
  }
}

type TimeTrackingPageProps = {
  data: TimeTrackingPageData
}

const TimeTrackingPage = ({ data }: TimeTrackingPageProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [isPending, startTransition] = useTransition()

  const { search, setSearch, status, setStatus } = useTimeEntryListState(startTransition)

  const [createOpen, setCreateOpen] = useState(false)
  const [editEntry, setEditEntry] = useState<TimeEntryListItem | null>(null)
  const [deleteIds, setDeleteIds] = useState<string[]>([])
  const [isDeleting, startDeleting] = useTransition()

  const locale = data.defaults.defaultLocale
  const timeZone = data.defaults.defaultTimezone

  const columns = useMemo<ColumnDef<TimeEntryListItem>[]>(() => {
    const projectOptions = data.projectOptions.map((project) => ({
      label: t("timeTracking.fields.projectOption", {
        client: project.clientName,
        project: project.name
      }),
      value: project.id
    }))

    const taskOptions = data.taskOptions.map((task) => ({ label: task.title, value: task.id }))

    return getTimeEntryColumns({
      t,
      locale,
      timeZone,
      projectOptions,
      taskOptions,
      onEdit: setEditEntry,
      setDeleteIds
    })
  }, [t, locale, timeZone, data.projectOptions, data.taskOptions])

  const { table } = useDataTable({
    data: data.entries,
    columns,
    getRowId: (entry) => entry.id,
    rowCount: data.rowCount,
    shallow: false,
    startTransition,
    columnVisibilityStorageKey: "time-entries:column-visibility",
    enableRowSelection: (row) => !row.original.deletedAt && !row.original.invoicedInId,
    initialState: { sorting: [{ id: "started", desc: true }] }
  })

  const activeFilterCount = table.getState().columnFilters.length + (status !== "active" ? 1 : 0)
  const hasActiveFilters = search !== "" || status !== "active" || activeFilterCount > 0
  const hasNoEntries = data.rowCount === 0 && !hasActiveFilters

  const canLogTime = data.projectOptions.length > 0

  const editFormData = toEditFormData(editEntry)

  const reset = () => {
    void setSearch("")

    setStatus("active")

    table.resetColumnFilters()
  }

  const onConfirmDelete = () => {
    if (isDeleting) return

    startDeleting(async () => {
      const results = await Promise.all(deleteIds.map((id) => softDeleteTimeEntry({ id })))
      const failed = results.find((result) => "error" in result)

      if (failed && "error" in failed) {
        toast.error(failed.error)

        return
      }

      toast.success(t("timeTracking.delete.deleted"))

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
                name="Clock"
                className="text-muted-foreground size-6 shrink-0"
                aria-hidden="true"
              />
              <Typography variant="h2">{t("timeTracking.list.title")}</Typography>
            </div>
            <Typography variant="p" affects={["muted", "removePMargin"]}>
              {t("timeTracking.list.description")}
            </Typography>
          </div>
          <Button onClick={() => setCreateOpen(true)} disabled={!canLogTime}>
            <Icon name="Plus" aria-hidden="true" />
            {t("timeTracking.actions.logManually")}
          </Button>
        </header>
        <TimerCard
          runningTimer={data.runningTimer}
          projectOptions={data.projectOptions}
          taskOptions={data.taskOptions}
          locale={locale}
        />
        <TimeTrackingSummaryBand summary={data.summary} locale={locale} />
        <DataTable
          table={table}
          caption={t("timeTracking.list.tableTitle")}
          getRowClassName={(entry) => (entry.deletedAt ? "opacity-50" : "")}
          isLoading={isPending}
          actionBar={({ selectedRows }) => (
            <Button
              variant="destructive"
              size="sm"
              disabled={isDeleting}
              onClick={() => setDeleteIds(selectedRows.map((entry) => entry.id))}
            >
              <Icon name="Trash2" aria-hidden="true" />
              {t("timeTracking.list.bulkDelete")} ({selectedRows.length})
            </Button>
          )}
          empty={
            <TimeTrackingEmpty
              hasNoEntries={hasNoEntries}
              canLogTime={canLogTime}
              onCreate={() => setCreateOpen(true)}
              onReset={reset}
            />
          }
        >
          <TimeTrackingFilters
            table={table}
            rowCount={data.rowCount}
            search={search}
            status={status}
            hasProjects={data.projectOptions.length > 0}
            hasTasks={data.taskOptions.length > 0}
            hasActiveFilters={hasActiveFilters}
            activeFilterCount={activeFilterCount}
            onSearchChange={setSearch}
            onStatusChange={setStatus}
            onReset={reset}
          />
        </DataTable>
        <TimeEntryFormSheet
          mode="create"
          open={createOpen}
          projectOptions={data.projectOptions}
          taskOptions={data.taskOptions}
          onOpenChange={setCreateOpen}
          onSuccess={() => router.refresh()}
        />
        {editFormData ? (
          <TimeEntryFormSheet
            mode="edit"
            entry={editFormData}
            open
            projectOptions={data.projectOptions}
            taskOptions={data.taskOptions}
            onOpenChange={(open) => {
              if (!open) setEditEntry(null)
            }}
            onSuccess={() => router.refresh()}
          />
        ) : null}
        <DeleteTimeEntryDialog
          open={deleteIds.length > 0}
          isDeleting={isDeleting}
          onOpenChange={(open) => {
            if (!open && !isDeleting) setDeleteIds([])
          }}
          onConfirm={onConfirmDelete}
        />
      </div>
    </ScrollArea>
  )
}

export { TimeTrackingPage }
