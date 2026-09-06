"use client"

import { useMemo, useState, useTransition } from "react"

import { useTranslation } from "@/lib/i18n"

import { formatCurrency } from "@/lib/utils"

import {
  Button,
  Field,
  FieldError,
  FieldLabel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Spinner,
  toast
} from "@/components/ui"

import { convertBillableWork } from "../../billing"
import { BILLABLE_GROUPINGS, type BillableGroupingValue } from "../../schemas"
import {
  planBillableConversion,
  type BillableExpenseRow,
  type BillableTimeEntryRow
} from "../../services"
import { type BillableTargetInvoice } from "../../types"

import { BillableWorkPreview } from "./BillableWorkPreview"

const NEW_INVOICE_VALUE = "new"

type BillableWorkSheetProps = {
  open: boolean
  timeEntries: BillableTimeEntryRow[]
  expenses: BillableExpenseRow[]
  targets: BillableTargetInvoice[]
  locale: string
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

const BillableWorkSheet = ({
  open,
  timeEntries,
  expenses,
  targets,
  locale,
  onOpenChange,
  onSuccess
}: BillableWorkSheetProps) => {
  const { t } = useTranslation()

  const [grouping, setGrouping] = useState<BillableGroupingValue>("entry")
  const [targetInvoiceId, setTargetInvoiceId] = useState(NEW_INVOICE_VALUE)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, startSubmitting] = useTransition()

  // Advisory only. The same pure function runs again inside the action's transaction, against rows
  // read there, and that run is the one that decides — this one prices a snapshot the browser
  // fetched earlier and may already be stale.
  const plan = useMemo(
    () =>
      planBillableConversion({
        timeEntries,
        expenses,
        grouping,
        hourUnit: t("invoices.billable.hourUnit")
      }),
    [timeEntries, expenses, grouping, t]
  )

  const availableTargets =
    plan.outcome === "billable"
      ? targets.filter(
          (target) => target.clientId === plan.clientId && target.currency === plan.currency
        )
      : []

  const groupingLabels: Record<BillableGroupingValue, string> = {
    entry: t("invoices.billable.groupingEntry"),
    task: t("invoices.billable.groupingTask"),
    project: t("invoices.billable.groupingProject")
  }

  const onSubmit = () => {
    if (isSubmitting || plan.outcome !== "billable") return

    setSubmitError(null)

    startSubmitting(async () => {
      const result = await convertBillableWork({
        timeEntryIds: plan.timeEntryIds,
        expenseIds: plan.expenseIds,
        grouping,
        targetInvoiceId: targetInvoiceId === NEW_INVOICE_VALUE ? null : targetInvoiceId
      })

      if ("error" in result) {
        setSubmitError(result.error)

        return
      }

      toast.success(t("invoices.billable.billed", { number: result.data.invoice.number }))

      onOpenChange(false)
      onSuccess()
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-2xl">
        <SheetHeader className="border-border border-b">
          <SheetTitle>{t("invoices.billable.title")}</SheetTitle>
          <SheetDescription>{t("invoices.billable.description")}</SheetDescription>
        </SheetHeader>
        <SheetBody className="flex flex-col gap-6">
          <Field>
            <FieldLabel htmlFor="billable-grouping">
              {t("invoices.billable.groupingLabel")}
            </FieldLabel>
            <Select
              value={grouping}
              onValueChange={(value) => setGrouping(value as BillableGroupingValue)}
              disabled={isSubmitting}
            >
              <SelectTrigger id="billable-grouping">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BILLABLE_GROUPINGS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {groupingLabels[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="billable-target">{t("invoices.billable.targetLabel")}</FieldLabel>
            <Select
              value={targetInvoiceId}
              onValueChange={setTargetInvoiceId}
              disabled={isSubmitting}
            >
              <SelectTrigger id="billable-target">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NEW_INVOICE_VALUE}>
                  {t("invoices.billable.targetNew")}
                </SelectItem>
                {availableTargets.map((target) => (
                  <SelectItem key={target.id} value={target.id}>
                    {`${target.number} — ${formatCurrency(target.totalCents, target.currency, locale)}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div aria-live="polite">
            <BillableWorkPreview plan={plan} locale={locale} />
          </div>
        </SheetBody>
        <SheetFooter className="border-border flex-col items-stretch gap-2 border-t">
          <Button onClick={onSubmit} disabled={isSubmitting || plan.outcome !== "billable"}>
            {isSubmitting ? <Spinner /> : null}
            {t("invoices.billable.submit")}
          </Button>
          {submitError ? <FieldError errors={[{ message: submitError }]} /> : null}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export { BillableWorkSheet }
