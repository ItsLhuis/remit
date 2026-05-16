"use client"

import { useTranslation } from "@/lib/i18n"

import { Typography } from "@/components/ui"

import { TotpReconfigureDialog } from "../TotpReconfigureDialog"

const TwoFactorSection = () => {
  const { t } = useTranslation()

  return (
    <section className="space-y-4">
      <Typography variant="h4">{t("settings.security.twoFactor")}</Typography>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Typography variant="p" affects={["medium", "removePMargin"]}>
            {t("settings.security.authenticatorApp")}
          </Typography>
          <Typography variant="p" affects={["muted", "removePMargin", "small"]}>
            {t("settings.security.authenticatorDescription")}
          </Typography>
        </div>
        <TotpReconfigureDialog />
      </div>
    </section>
  )
}

export { TwoFactorSection }
