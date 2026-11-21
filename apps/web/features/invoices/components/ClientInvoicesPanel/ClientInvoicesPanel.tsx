"use client"

import { useMemo } from "react"

import { useTranslation } from "@/lib/i18n"

import {
  DataTable,
  DataTableFacetedFilter,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Icon,
  Typography
} from "@/components/ui"

import { useDataTable, type ColumnDef } from "@/hooks"

import { type InvoiceListItem } from "../../types"

import { getClientInvoiceColumns } from "./columns"

type ClientInvoicesPanelProps = {
  invoices: InvoiceListItem[]
  locale: string
}

const ClientInvoicesPanel = ({ invoices, locale }: ClientInvoicesPanelProps) => {
  const { t } = useTranslation()

  const now = useMemo(() => new Date(), [])

  const columns = useMemo<ColumnDef<InvoiceListItem>[]>(
    () => getClientInvoiceColumns({ t, locale, now }),
    [t, locale, now]
  )

  const { table } = useDataTable({
    data: invoices,
    columns,
    getRowId: (invoice) => invoice.id,
    enableRowSelection: false,
    // Third table on the client workspace, beside the projects and contacts tabs. Without a distinct
    // prefix all three read the same query parameters and paginating one paginates the others.
    urlKeyPrefix: "invoice_",
    initialState: { pagination: { pageIndex: 0, pageSize: 10 } }
  })

  const statusColumn = table.getColumn("status")

  return (
    <DataTable
      table={table}
      caption={t("invoices.clientPanel.title")}
      empty={
        <Empty className="border-0 py-8">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Icon name="ReceiptText" />
            </EmptyMedia>
            <EmptyTitle>{t("invoices.clientPanel.emptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("invoices.clientPanel.emptyDescription")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      }
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Typography affects={["small", "medium"]}>{t("invoices.clientPanel.title")}</Typography>
        {statusColumn ? (
          <DataTableFacetedFilter column={statusColumn} title={t("invoices.table.statusColumn")} />
        ) : null}
      </div>
    </DataTable>
  )
}

export { ClientInvoicesPanel }
