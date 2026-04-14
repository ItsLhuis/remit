import { type Metadata } from "next"

import { SidebarTrigger, Typography } from "@/components/ui"

import { TotpReconfigureDialog } from "@/features/settings/security/components"

export const metadata: Metadata = {
  title: "Security — Settings"
}

const SecuritySettingsPage = () => {
  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <header className="flex items-center gap-2">
        <SidebarTrigger className="md:hidden" />
        <Typography variant="h2">Security</Typography>
      </header>
      <div className="space-y-8">
        <section className="space-y-4">
          <Typography variant="h4">Two-factor authentication</Typography>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <Typography variant="p" affects={["bold", "removePMargin"]}>
                Authenticator app
              </Typography>
              <Typography variant="p" affects={["muted", "removePMargin"]} className="text-sm">
                Replace your authenticator app or migrate to a new device. Your current codes will
                stop working once reconfiguration is complete.
              </Typography>
            </div>
            <TotpReconfigureDialog />
          </div>
        </section>
      </div>
    </div>
  )
}

export default SecuritySettingsPage
