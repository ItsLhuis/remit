import { Typography } from "@/components/ui"

import { TotpReconfigureDialog } from "../TotpReconfigureDialog"

const TwoFactorSection = () => (
  <section className="space-y-4">
    <Typography variant="h4">Two-factor authentication</Typography>
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <Typography variant="p" affects={["medium", "removePMargin"]}>
          Authenticator app
        </Typography>
        <Typography variant="p" affects={["muted", "removePMargin", "small"]}>
          Replace your authenticator app or migrate to a new device. Your current codes will stop
          working once reconfiguration is complete.
        </Typography>
      </div>
      <TotpReconfigureDialog />
    </div>
  </section>
)

export { TwoFactorSection }
