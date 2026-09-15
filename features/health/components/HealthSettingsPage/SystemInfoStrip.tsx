"use client"

import { useTranslation } from "@/lib/i18n"

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Typography
} from "@/components/ui"

import { type SystemInfo } from "../../types"

import { FingerprintCopyButton } from "./FingerprintCopyButton"

type SystemInfoStripProps = {
  systemInfo: SystemInfo
}

// The links are the whole update surface, on purpose. Remit makes no request to learn whether a
// newer release exists (ADR-0018), and there is no upgrade button because upgrade runs on the host
// and the app container never touches Docker (ADR-0020): a button that appeared to upgrade and could
// not would be worse than none.
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
      {systemInfo.releaseLinks ? (
        <CardFooter className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={systemInfo.releaseLinks.changelogUrl}>
              {t("health.systemInfo.changelogLink")}
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={systemInfo.releaseLinks.upgradeGuideUrl}>
              {t("health.systemInfo.upgradeGuideLink")}
            </a>
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  )
}

export { SystemInfoStrip }
