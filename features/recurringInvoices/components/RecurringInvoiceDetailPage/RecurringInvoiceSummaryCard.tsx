"use client"

import { useId } from "react"

import { useTranslation, type TFunction } from "@/lib/i18n"

import { formatCurrency, formatDate } from "@/lib/utils"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DescriptionDetails,
  DescriptionItem,
  DescriptionList,
  DescriptionTerm,
  Separator,
  Typography
} from "@/components/ui"

import { type RecurringInvoiceEndCondition } from "../../schemas"
import { toRetainerTerms } from "../../services"
import { type RecurringInvoiceDetail } from "../../types"

// The schedule stores its end condition across two independently nullable columns rather than a
// discriminator, so the answer to "when does this stop?" is re-derived here the same way
// schemas.ts's form shape derives it. Only one of the two columns is ever set (toScheduleColumns in
// mutations.ts clears the other), so the order of these checks cannot change the answer.
function getEndCondition(schedule: RecurringInvoiceDetail): RecurringInvoiceEndCondition {
  if (schedule.endByDate) return "by_date"

  if (schedule.endAfterCount !== null) return "after_count"

  return "never"
}

function getRetainerSummary(
  schedule: RecurringInvoiceDetail,
  locale: string,
  t: TFunction
): string {
  const terms = toRetainerTerms(schedule)

  if (!terms) return t("recurringInvoices.detail.retainerNone")

  return t("recurringInvoices.detail.retainer", {
    includedHours: terms.includedHours,
    rate: formatCurrency(terms.overageRateCents, schedule.currency, locale)
  })
}

type RecurringInvoiceSummaryRowProps = {
  label: string
  value: string
  mono?: boolean
}

// `aria-labelledby` names each value by its term. A `<dl>` already pairs them for a screen reader
// walking the list, but a `definition` has no accessible name of its own, so without the link a
// value cannot be reached by its label — by assistive technology jumping to it, or by a test.
const RecurringInvoiceSummaryRow = ({ label, value, mono }: RecurringInvoiceSummaryRowProps) => {
  const termId = useId()

  return (
    <DescriptionItem>
      <DescriptionTerm id={termId}>{label}</DescriptionTerm>
      <DescriptionDetails
        aria-labelledby={termId}
        className={mono ? "font-mono tabular-nums" : undefined}
      >
        {value}
      </DescriptionDetails>
    </DescriptionItem>
  )
}

type RecurringInvoiceSummaryCardProps = {
  schedule: RecurringInvoiceDetail
  locale: string
  timeZone: string
}

// Every date here is a UTC midnight written by computeNextRunDate's `toUtcDay`, so it is formatted
// with the instance time zone rather than through `formatDay`: that helper resolves the instant in
// whatever zone the viewer's machine is in, and west of UTC that names the previous day.
const RecurringInvoiceSummaryCard = ({
  schedule,
  locale,
  timeZone
}: RecurringInvoiceSummaryCardProps) => {
  const { t } = useTranslation()

  const endCondition = getEndCondition(schedule)
  const retainerSummary = getRetainerSummary(schedule, locale, t)

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{t("recurringInvoices.detail.scheduleSummary")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <DescriptionList>
          <RecurringInvoiceSummaryRow
            label={t("recurringInvoices.fields.client")}
            value={schedule.clientName}
          />
          <RecurringInvoiceSummaryRow
            label={t("recurringInvoices.fields.project")}
            value={schedule.projectName ?? t("recurringInvoices.detail.noProject")}
          />
          <RecurringInvoiceSummaryRow
            label={t("recurringInvoices.fields.cadence")}
            value={t(`recurringInvoices.cadence.${schedule.cadence}`)}
          />
          {schedule.cadenceDay === null ? null : (
            <RecurringInvoiceSummaryRow
              label={t("recurringInvoices.fields.cadenceDay")}
              value={String(schedule.cadenceDay)}
              mono
            />
          )}
        </DescriptionList>
        <Separator />
        <DescriptionList>
          <RecurringInvoiceSummaryRow
            label={t("recurringInvoices.detail.nextRun")}
            value={formatDate(schedule.nextRunAt, { locale, timeZone })}
          />
          <RecurringInvoiceSummaryRow
            label={t("recurringInvoices.detail.lastRun")}
            value={schedule.lastRunAt ? formatDate(schedule.lastRunAt, { locale, timeZone }) : "—"}
          />
          <RecurringInvoiceSummaryRow
            label={t("recurringInvoices.list.columns.occurrences")}
            value={t("recurringInvoices.detail.occurrences", {
              count: schedule.occurrencesGenerated
            })}
          />
          <RecurringInvoiceSummaryRow
            label={t("recurringInvoices.detail.endCondition")}
            value={t(`recurringInvoices.endCondition.${endCondition}`)}
          />
          {schedule.endAfterCount === null ? null : (
            <RecurringInvoiceSummaryRow
              label={t("recurringInvoices.fields.endAfterCount")}
              value={String(schedule.endAfterCount)}
              mono
            />
          )}
          {schedule.endByDate ? (
            <RecurringInvoiceSummaryRow
              label={t("recurringInvoices.fields.endByDate")}
              value={formatDate(schedule.endByDate, { locale, timeZone })}
            />
          ) : null}
        </DescriptionList>
        <Separator />
        <DescriptionList>
          <RecurringInvoiceSummaryRow
            label={t("recurringInvoices.fields.currency")}
            value={schedule.currency}
            mono
          />
          <RecurringInvoiceSummaryRow
            label={t("recurringInvoices.fields.autoSend")}
            value={schedule.autoSend ? t("common.status.yes") : t("common.status.no")}
          />
        </DescriptionList>
        <Separator />
        <div className="flex flex-col gap-1">
          <Typography affects={["small", "medium"]}>
            {t("recurringInvoices.form.sections.retainer")}
          </Typography>
          <Typography affects={["muted", "small"]}>{retainerSummary}</Typography>
        </div>
      </CardContent>
    </Card>
  )
}

export { RecurringInvoiceSummaryCard }
