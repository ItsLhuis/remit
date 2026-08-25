"use client"

import { useMemo, useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import { useTranslation } from "@/lib/i18n"

import { downloadCsv, formatCentsForInput } from "@/lib/utils"

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

import { useExpenseListState } from "../../hooks"
import { exportExpensesCsv, softDeleteExpense } from "../../mutations"
import { type ExpenseFormData, type ExpenseListItem, type ExpensesPageData } from "../../types"
import { DeleteExpenseDialog } from "../DeleteExpenseDialog"
import { ExpenseFormSheet } from "../ExpenseFormSheet"

import { getExpenseColumns } from "./columns"
import { ExpensesEmpty } from "./ExpensesEmpty"
import { ExpensesFilters } from "./ExpensesFilters"
import { ExpensesSummaryBand } from "./ExpensesSummaryBand"

// The sheet is fed from the list row rather than from a fresh read: the row already carries every
// field the form binds, and `updateExpense` re-validates all of them at the trust boundary.
function toEditFormData(expense: ExpenseListItem | null): ExpenseFormData | null {
  if (!expense) return null

  return {
    id: expense.id,
    projectId: expense.projectId ?? "",
    clientId: expense.clientId ?? "",
    spentAt: expense.spentAt.toISOString().slice(0, 10),
    amount: formatCentsForInput(expense.amountCents),
    currency: expense.currency,
    category: expense.category,
    description: expense.description,
    rebillable: expense.rebillable,
    markupPercentage: expense.markupPercentage === null ? "" : String(expense.markupPercentage),
    receipt: expense.receipt
      ? {
          objectKey: expense.receipt.path,
          filename: expense.receipt.filename,
          mimeType: expense.receipt.mimeType,
          sizeBytes: expense.receipt.sizeBytes
        }
      : null
  }
}

type ExpensesListPageProps = {
  data: ExpensesPageData
}

const ExpensesListPage = ({ data }: ExpensesListPageProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [isPending, startTransition] = useTransition()

  const { search, setSearch, status, setStatus } = useExpenseListState(startTransition)

  const [createOpen, setCreateOpen] = useState(false)
  const [editExpense, setEditExpense] = useState<ExpenseListItem | null>(null)
  const [deleteIds, setDeleteIds] = useState<string[]>([])
  const [isDeleting, startDeleting] = useTransition()
  const [isExporting, startExporting] = useTransition()

  const locale = data.defaults.defaultLocale

  const columns = useMemo<ColumnDef<ExpenseListItem>[]>(() => {
    const projectOptions = data.projectOptions.map((project) => ({
      label: t("expenses.fields.projectOption", {
        client: project.clientName,
        project: project.name
      }),
      value: project.id
    }))

    return getExpenseColumns({
      t,
      locale,
      projectOptions,
      clientOptions: data.clientOptions.map((client) => ({ label: client.name, value: client.id })),
      categoryOptions: data.categoryOptions.map((category) => ({
        label: category,
        value: category
      })),
      currencyOptions: data.currencyOptions.map((currency) => ({
        label: currency,
        value: currency
      })),
      onEdit: setEditExpense,
      setDeleteIds
    })
  }, [
    t,
    locale,
    data.projectOptions,
    data.clientOptions,
    data.categoryOptions,
    data.currencyOptions
  ])

  const { table } = useDataTable({
    data: data.expenses,
    columns,
    getRowId: (expense) => expense.id,
    rowCount: data.rowCount,
    shallow: false,
    startTransition,
    columnVisibilityStorageKey: "expenses:column-visibility",
    enableRowSelection: (row) => !row.original.deletedAt && !row.original.invoicedInId,
    initialState: { sorting: [{ id: "spentAt", desc: true }] }
  })

  const activeFilterCount = table.getState().columnFilters.length + (status !== "active" ? 1 : 0)
  const hasActiveFilters = search !== "" || status !== "active" || activeFilterCount > 0
  const hasNoExpenses = data.rowCount === 0 && !hasActiveFilters

  const editFormData = toEditFormData(editExpense)

  const reset = () => {
    void setSearch("")

    setStatus("active")

    table.resetColumnFilters()
  }

  // `data.query` is what the server built this page from, so handing the action the same query is
  // what makes the export cover exactly the rows on screen rather than an unfiltered dump.
  const onExport = () => {
    if (isExporting) return

    startExporting(async () => {
      const result = await exportExpensesCsv(data.query)

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      downloadCsv(result.data.csv, result.data.filename)

      toast.success(t("expenses.export.exported", { count: result.data.rowCount }))
    })
  }

  const onConfirmDelete = () => {
    if (isDeleting) return

    startDeleting(async () => {
      const results = await Promise.all(deleteIds.map((id) => softDeleteExpense({ id })))
      const failed = results.find((result) => "error" in result)

      if (failed && "error" in failed) {
        toast.error(failed.error)

        return
      }

      toast.success(t("expenses.delete.deleted"))

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
                name="Wallet"
                className="text-muted-foreground size-6 shrink-0"
                aria-hidden="true"
              />
              <Typography variant="h2">{t("expenses.list.title")}</Typography>
            </div>
            <Typography variant="p" affects={["muted", "removePMargin"]}>
              {t("expenses.list.description")}
            </Typography>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Icon name="Plus" aria-hidden="true" />
            {t("expenses.actions.create")}
          </Button>
        </header>
        <ExpensesSummaryBand summary={data.summary} locale={locale} />
        <DataTable
          table={table}
          caption={t("expenses.list.tableTitle")}
          getRowClassName={(expense) => (expense.deletedAt ? "opacity-50" : "")}
          isLoading={isPending}
          actionBar={({ selectedRows }) => (
            <Button
              variant="destructive"
              size="sm"
              disabled={isDeleting}
              onClick={() => setDeleteIds(selectedRows.map((expense) => expense.id))}
            >
              <Icon name="Trash2" aria-hidden="true" />
              {t("expenses.list.bulkDelete")} ({selectedRows.length})
            </Button>
          )}
          empty={
            <ExpensesEmpty
              hasNoExpenses={hasNoExpenses}
              onCreate={() => setCreateOpen(true)}
              onReset={reset}
            />
          }
        >
          <ExpensesFilters
            table={table}
            rowCount={data.rowCount}
            search={search}
            status={status}
            hasActiveFilters={hasActiveFilters}
            activeFilterCount={activeFilterCount}
            isExporting={isExporting}
            onSearchChange={setSearch}
            onStatusChange={setStatus}
            onExport={onExport}
            onReset={reset}
          />
        </DataTable>
        <ExpenseFormSheet
          mode="create"
          open={createOpen}
          projectOptions={data.projectOptions}
          clientOptions={data.clientOptions}
          categoryOptions={data.categoryOptions}
          defaultCurrency={data.defaults.defaultCurrency}
          locale={data.defaults.defaultLocale}
          attachments={[]}
          canWriteAttachments={data.canWriteAttachments}
          onOpenChange={setCreateOpen}
          onSuccess={() => router.refresh()}
        />
        {editFormData ? (
          <ExpenseFormSheet
            mode="edit"
            expense={editFormData}
            open
            projectOptions={data.projectOptions}
            clientOptions={data.clientOptions}
            categoryOptions={data.categoryOptions}
            defaultCurrency={data.defaults.defaultCurrency}
            locale={data.defaults.defaultLocale}
            attachments={data.attachmentsByExpense[editFormData.id] ?? []}
            canWriteAttachments={data.canWriteAttachments}
            onOpenChange={(open) => {
              if (!open) setEditExpense(null)
            }}
            onSuccess={() => router.refresh()}
          />
        ) : null}
        <DeleteExpenseDialog
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

export { ExpensesListPage }
