"use client"

import Link from "next/link"

import { useTranslation } from "@/lib/i18n"

import { formatDate } from "@/lib/utils"

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Icon,
  Typography
} from "@/components/ui"

import { type BackupSettingsStatus } from "../../queries"

type BackupStatusPanelProps = {
  status: BackupSettingsStatus
  testConnectionAt: string | null
  locale: string
}

// The last outcome, not a verdict on it. `/settings/system` owns whether a backup is fresh or stale
// (features/health/queries.ts's `getBackupHealthCheck`), and duplicating that judgement here would
// give an operator two answers to one question. What belongs beside the configuration is the raw
// result, because a failed backup is usually a failure of the settings on this page.
const BackupStatusPanel = ({ status, testConnectionAt, locale }: BackupStatusPanelProps) => {
  const { t } = useTranslation()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.backup.statusTitle")}</CardTitle>
        <CardDescription>{t("settings.backup.statusDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="space-y-1" aria-live="polite">
          <Typography variant="p" affects={["muted", "removePMargin", "small"]}>
            {status.backupLastSuccessAt
              ? t("settings.backup.lastSuccess", {
                  date: formatDate(new Date(status.backupLastSuccessAt), { locale })
                })
              : t("settings.backup.lastSuccessNever")}
          </Typography>
          <Typography variant="p" affects={["muted", "removePMargin", "small"]}>
            {testConnectionAt
              ? t("settings.backup.lastTest", {
                  date: formatDate(new Date(testConnectionAt), { locale })
                })
              : t("settings.backup.lastTestNever")}
          </Typography>
        </div>
        {status.backupLastFailureAt ? (
          <Alert>
            <Icon name="TriangleAlert" aria-hidden="true" />
            <AlertTitle>
              {t("settings.backup.lastFailure", {
                date: formatDate(new Date(status.backupLastFailureAt), { locale })
              })}
            </AlertTitle>
            <AlertDescription>
              {status.backupLastFailureReason ?? t("settings.backup.lastFailureUnknown")}
            </AlertDescription>
          </Alert>
        ) : null}
        <div className="space-y-1">
          <Typography variant="p" affects={["muted", "removePMargin", "small"]}>
            {t("settings.backup.runManually")}
          </Typography>
          <Typography variant="p" affects={["removePMargin", "small"]}>
            <Link className="underline underline-offset-4" href="/settings/system">
              {t("settings.backup.systemLink")}
            </Link>
          </Typography>
        </div>
      </CardContent>
    </Card>
  )
}

export { BackupStatusPanel }
