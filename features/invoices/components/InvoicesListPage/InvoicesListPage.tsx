"use client"

import { useMemo, useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import Link from "next/link"

import { useTranslation } from "@/lib/i18n"

import {
  Button,
  DataTable,
  DataTableViewOptions,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Icon,
  ScrollArea,
  SidebarTrigger,
  Typography,
  toast
} from "@/components/ui"

import { useDataTable, type ColumnDef } from "@/hooks"

import { createInvoiceFromProposal } from "../../conversion"
import { softDeleteInvoice } from "../../mutations"
import {
  type ConvertibleProposalOption,
  type InvoiceListItem,
  type InvoiceListPageData
} from "../../types"
import { ConvertProposalDialog } from "../ConvertProposalDialog"
import { DeleteInvoiceDialog } from "../DeleteInvoiceDialog"
import { InvoicesSummaryBand } from "../InvoicesSummaryBand"

import { getInvoiceColumns } from "./columns"

type InvoicesListPageProps = {
  data: InvoiceListPageData
  convertibleProposals: ConvertibleProposalOption[]
}

const InvoicesListPage = ({ data, convertibleProposals }: InvoicesListPageProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [convertOpen, setConvertOpen] = useState(false)
  const [isDeleting, startDeleting] = useTransition()
  const [isConverting, startConverting] = useTransition()
  const [isPending, startTransition] = useTransition()

  const locale = data.defaults.defaultLocale

  // Frozen once per render pass so every row on this page is judged overdue against the same
  // instant; a fresh `new Date()` inside each cell would let a table straddle midnight.
  const now = useMemo(() => new Date(), [])

  const columns = useMemo<ColumnDef<InvoiceListItem>[]>(
    () => getInvoiceColumns({ t, locale, projectId: data.projectId, now, onDelete: setDeleteId }),
    [t, locale, data.projectId, now]
  )

  const { table } = useDataTable({
    data: data.invoices,
    columns,
    getRowId: (invoice) => invoice.id,
    rowCount: data.invoices.length,
    shallow: false,
    startTransition,
    columnVisibilityStorageKey: "invoices:column-visibility",
    initialState: { sorting: [{ id: "issueDate", desc: true }] }
  })

  const hasFilters = table.getState().columnFilters.length > 0

  const createHref = `/projects/${data.projectId}/invoices/new`

  const onConfirmDelete = () => {
    if (isDeleting || !deleteId) return

    startDeleting(async () => {
      const result = await softDeleteInvoice({ id: deleteId })

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      toast.success(t("invoices.notifications.deleted"))

      setDeleteId(null)

      router.refresh()
    })
  }

  const onConfirmConvert = (proposalId: string) => {
    if (isConverting) return

    startConverting(async () => {
      const result = await createInvoiceFromProposal({ proposalId })

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      toast.success(t("invoices.notifications.converted"))

      setConvertOpen(false)

      router.push(`/projects/${data.projectId}/invoices/${result.data.invoice.id}`)
      router.refresh()
    })
  }

  return (
    <ScrollArea className="size-full">
      <div className="flex w-full flex-col gap-6 p-4 md:p-8">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="md:hidden" />
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
            <Link href={`/projects/${data.projectId}`}>
              <Icon name="ArrowLeft" aria-hidden="true" />
              {t("invoices.list.backToProject")}
            </Link>
          </Button>
        </div>
        <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Icon
                name="Receipt"
                className="text-muted-foreground size-6 shrink-0"
                aria-hidden="true"
              />
              <Typography variant="h2">{t("invoices.list.title")}</Typography>
            </div>
            <Typography variant="p" affects={["muted", "removePMargin"]}>
              {t("invoices.list.description")}
            </Typography>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild>
              <Link href={createHref}>
                <Icon name="Plus" aria-hidden="true" />
                {t("invoices.list.createButton")}
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Icon name="ChevronDown" aria-hidden="true" />
                  {t("invoices.list.moreActions")}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onSelect={() => setConvertOpen(true)}>
                  <Icon name="FileInput" aria-hidden="true" />
                  {t("invoices.actions.convertProposal")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <InvoicesSummaryBand
          summary={data.summary}
          currency={data.currency}
          locale={locale}
          totalHint={t("invoices.summary.totalHint")}
        />
        <DataTable
          table={table}
          caption={t("invoices.list.title")}
          onRowClick={(invoice) =>
            router.push(`/projects/${data.projectId}/invoices/${invoice.id}`)
          }
          isLoading={isPending}
          empty={
            data.invoices.length === 0 ? (
              <Empty className="border-0 py-12">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Icon name="Receipt" />
                  </EmptyMedia>
                  <EmptyTitle>{t("invoices.empty.title")}</EmptyTitle>
                  <EmptyDescription>{t("invoices.empty.description")}</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button asChild>
                    <Link href={createHref}>
                      <Icon name="Plus" aria-hidden="true" />
                      {t("invoices.actions.create")}
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
                  <EmptyTitle>{t("invoices.empty.title")}</EmptyTitle>
                  <EmptyDescription>{t("invoices.empty.description")}</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button variant="outline" onClick={() => table.resetColumnFilters()}>
                    {t("invoices.list.clearFilters")}
                  </Button>
                </EmptyContent>
              </Empty>
            )
          }
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-0.5">
              <Typography affects={["small", "medium"]}>{t("invoices.list.title")}</Typography>
              <Typography affects={["muted", "tiny"]}>
                {t("invoices.list.count", { count: data.invoices.length })}
              </Typography>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {hasFilters ? (
                <Button variant="ghost" size="sm" onClick={() => table.resetColumnFilters()}>
                  <Icon name="X" aria-hidden="true" />
                  {t("invoices.list.clearFilters")}
                </Button>
              ) : null}
              <DataTableViewOptions table={table} />
            </div>
          </div>
        </DataTable>
        <ConvertProposalDialog
          open={convertOpen}
          proposals={convertibleProposals}
          locale={locale}
          isConverting={isConverting}
          onOpenChange={(open) => {
            if (!isConverting) setConvertOpen(open)
          }}
          onConfirm={onConfirmConvert}
        />
        <DeleteInvoiceDialog
          open={deleteId !== null}
          isDeleting={isDeleting}
          onOpenChange={(open) => {
            if (!open && !isDeleting) setDeleteId(null)
          }}
          onConfirm={onConfirmDelete}
        />
      </div>
    </ScrollArea>
  )
}

export { InvoicesListPage }
