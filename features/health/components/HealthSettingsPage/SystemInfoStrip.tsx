"use client"

import { useTranslation } from "@/lib/i18n"

import { type SystemInfo } from "../../types"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Typography
} from "@/components/ui"

import { FingerprintCopyButton } from "../FingerprintCopyButton"

type SystemInfoStripProps = {
  systemInfo: SystemInfo
}

const SystemInfoStrip = ({ systemInfo }: SystemInfoStripProps) => {
  const { t } = useTranslation()

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{t("health.systemInfo.title")}</CardTitle>
        <CardDescription>{t("health.systemInfo.description")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Typography variant="p" affects={["muted", "removePMargin", "small"]}>
            {t("health.systemInfo.versionLabel")}
          </Typography>
          <Typography affects="medium">{systemInfo.version}</Typography>
          <Typography variant="p" affects={["muted", "removePMargin", "small"]}>
            {t("health.systemInfo.versionHint")}
          </Typography>
        </div>
        <div className="space-y-1">
          <Typography variant="p" affects={["muted", "removePMargin", "small"]}>
            {t("health.systemInfo.fingerprintLabel")}
          </Typography>
          <div className="flex items-center gap-2">
            <Typography affects="medium">{systemInfo.encryptionFingerprint}</Typography>
            <FingerprintCopyButton fingerprint={systemInfo.encryptionFingerprint} />
          </div>
          <Typography variant="p" affects={["muted", "removePMargin", "small"]}>
            {t("health.systemInfo.fingerprintHint")}
          </Typography>
        </div>
      </CardContent>
    </Card>
  )
}

export { SystemInfoStrip }
