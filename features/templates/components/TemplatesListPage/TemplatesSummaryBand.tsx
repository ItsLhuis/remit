"use client"

import dynamic from "next/dynamic"

import { useTranslation, type TFunction } from "@/lib/i18n"

import { formatCompactNumber } from "@/lib/utils"

import { StatCard, StatValue } from "@/components/ui"

import { TEMPLATE_TYPE_LABEL_KEYS } from "../../labels"
import { TEMPLATE_TYPES } from "../../schemas"
import { getTemplateCategory, type TemplatesSummary } from "../../services"

import { TemplateBreakdown, type TemplateBreakdownItem } from "./TemplateBreakdown"

const DefaultCoverageDonut = dynamic(() => import("./charts").then((m) => m.DefaultCoverageDonut), {
  ssr: false
})

const DOCUMENT_TYPES = TEMPLATE_TYPES.filter((type) => getTemplateCategory(type) !== "email")

const EMAIL_TYPES = TEMPLATE_TYPES.filter((type) => getTemplateCategory(type) === "email")

// Six email types would make the legend taller than the card it sits in, so the tail is folded into
// one "Other" row rather than truncated - the segment widths must still add up to the email total.
const EMAIL_BREAKDOWN_LIMIT = 3

function toEmailBreakdownItems(summary: TemplatesSummary, t: TFunction): TemplateBreakdownItem[] {
  const ranked = EMAIL_TYPES.map((type) => ({
    key: type,
    label: t(TEMPLATE_TYPE_LABEL_KEYS[type]),
    value: summary.byType[type]
  })).toSorted((first, second) => second.value - first.value)

  const remainder = ranked.slice(EMAIL_BREAKDOWN_LIMIT).reduce((sum, item) => sum + item.value, 0)

  const top = ranked.slice(0, EMAIL_BREAKDOWN_LIMIT)

  if (remainder === 0) return top

  return [...top, { key: "other", label: t("templates.summary.otherEmails"), value: remainder }]
}

type TemplatesSummaryBandProps = {
  summary: TemplatesSummary
  locale: string
}

const TemplatesSummaryBand = ({ summary, locale }: TemplatesSummaryBandProps) => {
  const { t } = useTranslation()

  const emptyLabel = t("templates.summary.breakdownEmpty")

  const originItems: TemplateBreakdownItem[] = [
    { key: "custom", label: t("templates.origin.custom"), value: summary.custom },
    { key: "system", label: t("templates.origin.system"), value: summary.system }
  ]

  const documentItems: TemplateBreakdownItem[] = DOCUMENT_TYPES.map((type) => ({
    key: type,
    label: t(TEMPLATE_TYPE_LABEL_KEYS[type]),
    value: summary.byType[type]
  }))

  const emailItems = toEmailBreakdownItems(summary, t)

  const missingDefaults = summary.totalTypes - summary.coveredTypes

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard icon="LayoutTemplate" label={t("templates.summary.total")}>
        <StatValue
          value={formatCompactNumber(summary.total, locale)}
          title={summary.total.toString()}
          hint={
            summary.custom > 0
              ? t("templates.summary.customDelta", { count: summary.custom })
              : t("templates.summary.totalHint")
          }
        />
        <TemplateBreakdown items={originItems} emptyLabel={emptyLabel} />
      </StatCard>
      <StatCard icon="FileText" label={t("templates.summary.documents")}>
        <StatValue
          value={formatCompactNumber(summary.documents, locale)}
          title={summary.documents.toString()}
          hint={t("templates.summary.documentsHint")}
        />
        <TemplateBreakdown items={documentItems} emptyLabel={emptyLabel} />
      </StatCard>
      <StatCard icon="Mail" label={t("templates.summary.emails")}>
        <StatValue
          value={formatCompactNumber(summary.emails, locale)}
          title={summary.emails.toString()}
          hint={t("templates.summary.emailsHint")}
        />
        <TemplateBreakdown items={emailItems} emptyLabel={emptyLabel} />
      </StatCard>
      <StatCard icon="Star" label={t("templates.summary.defaults")}>
        <StatValue
          value={t("templates.summary.defaultsValue", {
            covered: summary.coveredTypes,
            total: summary.totalTypes
          })}
          title={summary.coveredTypes.toString()}
          hint={
            missingDefaults > 0
              ? t("templates.summary.defaultsMissingHint", { count: missingDefaults })
              : t("templates.summary.defaultsHint")
          }
          mono
        />
        <DefaultCoverageDonut covered={summary.coveredTypes} total={summary.totalTypes} />
      </StatCard>
    </div>
  )
}

export { TemplatesSummaryBand }
