"use client"

import { useTranslation } from "@/lib/i18n"

import { formatCurrency } from "@/lib/utils"

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Icon,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Typography
} from "@/components/ui"

import { type BillableConversionPlan, type BillableLineDraft } from "../../services"

// A draft line has no id, and the list reorders when the grouping changes. Its source row keys a
// single-source line; a grouped line is keyed by what grouped it — description and rate together are
// the grouping key services/billableConversion.ts used, so the pair is unique within a plan.
function toLineKey(line: BillableLineDraft): string {
  const source = line.sourceTimeEntryId ?? line.sourceExpenseId

  return source ?? `${line.description}|${line.unitPriceCents}`
}

type BillableWorkPreviewProps = {
  plan: BillableConversionPlan
  locale: string
}

const BillableWorkPreview = ({ plan, locale }: BillableWorkPreviewProps) => {
  const { t } = useTranslation()

  if (plan.outcome !== "billable") {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Icon name="ReceiptText" aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>{t("invoices.billable.previewTitle")}</EmptyTitle>
          <EmptyDescription>{t("invoices.billable.previewEmpty")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  const subtotalCents = plan.lines.reduce(
    (total, line) => total + Math.round(line.quantity * line.unitPriceCents),
    0
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-4">
        <Typography variant="p" affects={["medium", "removePMargin"]}>
          {t("invoices.billable.previewTitle")}
        </Typography>
        <Typography variant="p" affects={["muted", "small", "removePMargin"]}>
          {t("invoices.billable.previewLines", { count: plan.lines.length })}
        </Typography>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("invoices.lineItems.descriptionColumn")}</TableHead>
              <TableHead className="text-right">{t("invoices.lineItems.quantityColumn")}</TableHead>
              <TableHead className="text-right">
                {t("invoices.lineItems.unitPriceColumn")}
              </TableHead>
              <TableHead className="text-right">{t("invoices.lineItems.totalColumn")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plan.lines.map((line) => (
              <TableRow key={toLineKey(line)}>
                <TableCell>{line.description}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {line.quantity}
                  {line.unit ? ` ${line.unit}` : ""}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(line.unitPriceCents, plan.currency, locale)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(
                    Math.round(line.quantity * line.unitPriceCents),
                    plan.currency,
                    locale
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-baseline justify-between gap-4">
        <Typography variant="p" affects={["muted", "small", "removePMargin"]}>
          {t("invoices.billable.previewTotal")}
        </Typography>
        <Typography variant="p" affects={["medium", "removePMargin"]}>
          {formatCurrency(subtotalCents, plan.currency, locale)}
        </Typography>
      </div>
      {plan.unbillableTimeEntryIds.length > 0 ? (
        <Typography variant="p" affects={["muted", "small", "removePMargin"]}>
          {t("invoices.billable.previewExcluded", { count: plan.unbillableTimeEntryIds.length })}
        </Typography>
      ) : null}
    </div>
  )
}

export { BillableWorkPreview }
