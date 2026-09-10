"use client"

import Link from "next/link"

import { useTranslation, type TFunction } from "@/lib/i18n"

import { Alert, AlertDescription, AlertTitle, Button, Icon, type IconProps } from "@/components/ui"

import { type BackupBanner } from "../types"

type BannerPresentation = {
  description: string
  icon: IconProps["name"]
  title: string
  variant: "default" | "destructive"
}

// `neverRun` keeps the default variant while the other two are `destructive`, which in this design
// system is red text on the card ground rather than a solid fill (DESIGN.md, Destructive). An
// instance on its first day has not done anything wrong, and colouring that the same as a failed
// archive teaches an owner to ignore the banner before it ever means anything.
function getBannerPresentation(banner: BackupBanner, t: TFunction): BannerPresentation {
  switch (banner.state) {
    case "lastRunFailed":
      return {
        // The stored reason, which `redactBackupReason` already stripped of provider detail before
        // it reached the column.
        description: banner.lastFailureReason ?? t("backups.banner.lastRunFailedUnknown"),
        icon: "TriangleAlert",
        title: t("backups.banner.lastRunFailedTitle"),
        variant: "destructive"
      }
    case "overdue":
      return {
        description: t("backups.banner.overdueDescription"),
        icon: "Clock",
        title: t("backups.banner.overdueTitle"),
        variant: "destructive"
      }
    case "neverRun":
      return {
        description: t("backups.banner.neverRunDescription"),
        icon: "DatabaseBackup",
        title: t("backups.banner.neverRunTitle"),
        variant: "default"
      }
  }
}

const BackupStatusBanner = ({ banner }: { banner: BackupBanner }) => {
  const { t } = useTranslation()

  const presentation = getBannerPresentation(banner, t)

  return (
    // `role="status"` overrides the primitive's own `role="alert"`. This is derived state that is
    // already present when the page paints rather than a response to anything the owner just did, so
    // the assertive announcement `alert` implies would interrupt a screen reader on every dashboard
    // visit. The icon and the title carry the state as well as the colour does.
    <Alert variant={presentation.variant} role="status">
      <Icon name={presentation.icon} aria-hidden="true" />
      <AlertTitle>{presentation.title}</AlertTitle>
      <AlertDescription>{presentation.description}</AlertDescription>
      <Button asChild variant="outline" size="sm" className="mt-2 w-fit">
        <Link href="/settings/backup">{t("backups.banner.action")}</Link>
      </Button>
    </Alert>
  )
}

export { BackupStatusBanner }
