import { t } from "@/lib/i18n/server"

import { SidebarTrigger, Typography } from "@/components/ui"

const InvoicingSettingsPage = () => {
  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <header className="flex items-center gap-2">
        <SidebarTrigger className="md:hidden" />
        <Typography variant="h2">{t("settings.invoicing.title")}</Typography>
      </header>
    </div>
  )
}

export { InvoicingSettingsPage }
