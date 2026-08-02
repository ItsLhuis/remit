"use client"

import { useTranslation } from "@/lib/i18n"

import { formatCurrency } from "@/lib/utils"

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui"

import { type InvoiceDetailLineItem } from "../types"

type InvoiceLineItemsTableProps = {
  lineItems: InvoiceDetailLineItem[]
  currency: string
  locale: string
}

const InvoiceLineItemsTable = ({ lineItems, currency, locale }: InvoiceLineItemsTableProps) => {
  const { t } = useTranslation()

  return (
    <div className="ring-foreground/10 overflow-hidden rounded-xl ring-1">
      <Table>
        <TableCaption className="sr-only">{t("invoices.lineItems.title")}</TableCaption>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="text-muted-foreground h-9 text-xs font-medium">
              {t("invoices.lineItems.descriptionColumn")}
            </TableHead>
            <TableHead className="text-muted-foreground h-9 text-right text-xs font-medium">
              {t("invoices.lineItems.quantityColumn")}
            </TableHead>
            <TableHead className="text-muted-foreground h-9 text-right text-xs font-medium">
              {t("invoices.lineItems.unitPriceColumn")}
            </TableHead>
            <TableHead className="text-muted-foreground h-9 text-right text-xs font-medium">
              {t("invoices.lineItems.taxColumn")}
            </TableHead>
            <TableHead className="text-muted-foreground h-9 text-right text-xs font-medium">
              {t("invoices.lineItems.totalColumn")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lineItems.map((lineItem) => (
            <TableRow key={lineItem.id}>
              <TableCell className="py-2.5">
                <div className="flex flex-col">
                  <span className="font-medium">{lineItem.description}</span>
                  {lineItem.unit ? (
                    <span className="text-muted-foreground text-xs">{lineItem.unit}</span>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="py-2.5 text-right font-mono text-sm tabular-nums">
                {lineItem.quantity}
              </TableCell>
              <TableCell className="py-2.5 text-right font-mono text-sm tabular-nums">
                {formatCurrency(lineItem.unitPriceCents, currency, locale)}
              </TableCell>
              <TableCell className="text-muted-foreground py-2.5 text-right font-mono text-sm tabular-nums">
                {lineItem.taxPercentage}%
              </TableCell>
              <TableCell className="py-2.5 text-right font-mono text-sm font-medium tabular-nums">
                {formatCurrency(lineItem.totalCents, currency, locale)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export { InvoiceLineItemsTable }
