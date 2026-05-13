import { t } from "@/lib/i18n/server"

import { Typography } from "@/components/ui"

import { ChangePasswordDialog } from "../ChangePasswordDialog"

const ChangePasswordSection = () => (
  <section className="space-y-4">
    <Typography variant="h4">{t("settings.security.password")}</Typography>
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <Typography variant="p" affects={["medium", "removePMargin"]}>
          {t("settings.security.changePassword.title")}
        </Typography>
        <Typography variant="p" affects={["muted", "removePMargin", "small"]}>
          {t("settings.security.changePassword.description")}
        </Typography>
      </div>
      <ChangePasswordDialog />
    </div>
  </section>
)

export { ChangePasswordSection }
