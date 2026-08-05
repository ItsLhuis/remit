"use client"

import { useTranslation, type TFunction } from "@/lib/i18n"

import { formatCurrency, formatDate } from "@/lib/utils"

import { Card, CardContent, CardHeader, CardTitle, Separator, Typography } from "@/components/ui"

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

const RecurringInvoiceSummaryRow = ({ label, value, mono }: RecurringInvoiceSummaryRowProps) => (
  <div className="flex items-baseline justify-between gap-4">
    <Typography affects={["muted", "small"]}>{label}</Typography>
    <span className={mono ? "font-mono text-sm tabular-nums" : "text-sm"}>{value}</span>
  </div>
)

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
        <Separator />
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
        <Separator />
        <RecurringInvoiceSummaryRow
          label={t("recurringInvoices.fields.currency")}
          value={schedule.currency}
          mono
        />
        <RecurringInvoiceSummaryRow
          label={t("recurringInvoices.fields.autoSend")}
          value={schedule.autoSend ? t("common.status.yes") : t("common.status.no")}
        />
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
