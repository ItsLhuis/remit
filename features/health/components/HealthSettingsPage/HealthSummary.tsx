"use client"

import { cn } from "@/lib/utils"

import { useTranslation } from "@/lib/i18n"

import { Icon, Typography, type IconProps } from "@/components/ui"

import { type HealthCheckResult } from "../../types"

type HealthSummaryProps = {
  checks: HealthCheckResult[]
}

type SummaryTone = "ready" | "attention" | "error"

type Summary = {
  icon: IconProps["name"]
  title: string
  description: string
  tone: SummaryTone
}

const toneClassNames = {
  ready: "bg-success border-success-border text-success-foreground",
  attention: "bg-warning border-warning-border text-warning-foreground",
  error: "bg-error border-error-border text-error-foreground"
} satisfies Record<SummaryTone, string>

const descriptionClassNames = {
  ready: "text-success-muted-foreground",
  attention: "text-warning-muted-foreground",
  error: "text-error-muted-foreground"
} satisfies Record<SummaryTone, string>

const getSummary = (
  checks: HealthCheckResult[],
  t: ReturnType<typeof useTranslation>["t"]
): Summary => {
  const issueChecks = checks.filter((check) => check.countsAsIssue)

  const hasError = issueChecks.some((check) => check.status === "error")
  const hasBackupRisk = issueChecks.some((check) => check.id === "backup")

  if (issueChecks.length === 0) {
    return {
      icon: "CircleCheck",
      title: t("health.dashboard.readyTitle"),
      description: t("health.dashboard.readyDescription"),
      tone: "ready"
    }
  }

  if (hasBackupRisk) {
    return {
      icon: "ShieldAlert",
      title: t("health.dashboard.dataAttentionTitle"),
      description: t("health.dashboard.issueSummary", { count: issueChecks.length }),
      tone: hasError ? "error" : "attention"
    }
  }

  return {
    icon: hasError ? "CircleAlert" : "TriangleAlert",
    title: t("health.dashboard.attentionTitle", { count: issueChecks.length }),
    description: t("health.dashboard.issueSummary", { count: issueChecks.length }),
    tone: hasError ? "error" : "attention"
  }
}

const HealthSummary = ({ checks }: HealthSummaryProps) => {
  const { t } = useTranslation()

  const summary = getSummary(checks, t)

  return (
    <section className={cn("rounded-lg border p-4", toneClassNames[summary.tone])}>
      <div className="flex gap-3">
        <Icon name={summary.icon} className="mt-0.5 shrink-0" aria-hidden="true" />
        <div className="space-y-1">
          <Typography affects="medium">{summary.title}</Typography>
          <Typography
            variant="p"
            affects={["muted", "removePMargin", "small"]}
            className={descriptionClassNames[summary.tone]}
          >
            {summary.description}
          </Typography>
        </div>
      </div>
    </section>
  )
}

export { HealthSummary }
