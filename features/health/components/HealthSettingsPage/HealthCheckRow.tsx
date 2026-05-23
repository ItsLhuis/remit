"use client"

import { cn, formatDate } from "@/lib/utils"

import { useTranslation } from "@/lib/i18n"

import Link from "next/link"

import { Badge, Button, Icon, Typography, type IconProps } from "@/components/ui"

import { FingerprintCopyButton } from "../FingerprintCopyButton"

import { type HealthCheckResult, type HealthStatus } from "../../types"

type HealthCheckRowProps = {
  check: HealthCheckResult
}

type StatusConfig = {
  icon: IconProps["name"]
  label: string
  badgeVariant: "success" | "warning" | "error" | "info" | "secondary"
  iconClassName: string
}

function getStatusConfig(
  status: HealthStatus,
  t: ReturnType<typeof useTranslation>["t"]
): StatusConfig {
  const statuses = {
    healthy: {
      icon: "CircleCheck",
      label: t("health.status.healthy"),
      badgeVariant: "success",
      iconClassName: "text-success-foreground"
    },
    attention: {
      icon: "TriangleAlert",
      label: t("health.status.attention"),
      badgeVariant: "warning",
      iconClassName: "text-warning-foreground"
    },
    error: {
      icon: "CircleX",
      label: t("health.status.error"),
      badgeVariant: "error",
      iconClassName: "text-error-foreground"
    },
    notSetup: {
      icon: "CircleDashed",
      label: t("health.status.notSetup"),
      badgeVariant: "secondary",
      iconClassName: "text-muted-foreground"
    },
    optional: {
      icon: "CircleMinus",
      label: t("health.status.optional"),
      badgeVariant: "secondary",
      iconClassName: "text-muted-foreground"
    },
    info: {
      icon: "Info",
      label: t("health.status.info"),
      badgeVariant: "info",
      iconClassName: "text-info-foreground"
    }
  } satisfies Record<HealthStatus, StatusConfig>

  return statuses[status]
}

function getBackupDetails(
  check: HealthCheckResult,
  locale: string,
  t: ReturnType<typeof useTranslation>["t"]
): string[] {
  const details = [
    t("health.checks.backup.destination", {
      destination: (check.backupDestination ?? "local").toUpperCase()
    }),
    check.backupLastSuccessAt
      ? t("health.checks.backup.lastSuccess", {
          date: formatDate(new Date(check.backupLastSuccessAt), { locale })
        })
      : t("health.checks.backup.notRecorded")
  ]

  if (check.backupLastFailureAt) {
    details.push(
      t("health.checks.backup.lastFailure", {
        date: formatDate(new Date(check.backupLastFailureAt), { locale })
      })
    )

    if (check.backupLastFailureReason) {
      details.push(
        t("health.checks.backup.lastFailureReason", {
          reason: check.backupLastFailureReason
        })
      )
    }
  } else {
    details.push(t("health.checks.backup.neverFailed"))
  }

  return details
}

const HealthCheckRow = ({ check }: HealthCheckRowProps) => {
  const { i18n, t } = useTranslation()

  const status = getStatusConfig(check.status, t)

  const locale = i18n.resolvedLanguage ?? i18n.language
  const summary =
    check.id === "backup" && check.backupLastSuccessAt
      ? t("health.checks.backup.lastSuccess", {
          date: formatDate(new Date(check.backupLastSuccessAt), { locale })
        })
      : check.summary

  const isFingerprint = check.id === "encryption-key"
  const backupDetails = check.id === "backup" ? getBackupDetails(check, locale, t) : []

  return (
    <div className="flex flex-col gap-3 p-4 not-last:border-b md:flex-row md:items-start md:justify-between">
      <div className="flex min-w-0 gap-3">
        <Icon
          name={status.icon}
          className={cn("mt-0.5 shrink-0", status.iconClassName)}
          aria-hidden="true"
        />
        <div className="min-w-0 space-y-2">
          <div className="space-y-1">
            <Typography affects="medium">{check.title}</Typography>
            <Typography variant="p" affects={["removePMargin", "small"]} suppressHydrationWarning>
              {summary}
            </Typography>
            <Typography variant="p" affects={["muted", "removePMargin", "small"]}>
              {check.detail}
            </Typography>
            {backupDetails.length > 0 ? (
              <div className="space-y-1">
                {backupDetails.map((detail) => (
                  <Typography
                    key={detail}
                    variant="p"
                    affects={["muted", "removePMargin", "small"]}
                    suppressHydrationWarning
                  >
                    {detail}
                  </Typography>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 md:justify-end">
        <Badge variant={status.badgeVariant}>{status.label}</Badge>
        {isFingerprint ? <FingerprintCopyButton fingerprint={check.summary} /> : null}
        {check.actionHref && check.actionLabel ? (
          <Button asChild variant="outline" size="sm">
            <Link href={check.actionHref}>{check.actionLabel}</Link>
          </Button>
        ) : null}
      </div>
    </div>
  )
}

export { HealthCheckRow }
