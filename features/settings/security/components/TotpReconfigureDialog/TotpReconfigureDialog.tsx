"use client"

import { useState } from "react"

import { useTranslation } from "@/lib/i18n"

import { Button, Dialog, DialogContent, DialogTrigger, toast } from "@/components/ui"

import { CodesStep } from "./CodesStep"
import { ConfirmStep } from "./ConfirmStep"
import { ScanStep } from "./ScanStep"

type Step = "confirm" | "scan" | "codes"

type ReconfigureState = {
  totpUri: string
  backupCodes: string[]
  // Held across steps because Better Auth needs it twice and the flow can only ask once:
  // `ConfirmStep` spends it on `twoFactor.enable`, and `ScanStep` needs it again for
  // `generateBackupCodes` after the code verifies. By then the dialog has locked itself shut, so
  // there is nowhere left to re-prompt. `reset` drops it as soon as the dialog closes.
  password: string
}

const TotpReconfigureDialog = () => {
  const { t } = useTranslation()

  const [open, setOpen] = useState(false)

  const [step, setStep] = useState<Step>("confirm")

  const [state, setState] = useState<Partial<ReconfigureState>>({})

  const reset = () => {
    setStep("confirm")
    setState({})
  }

  // Deliberately refuses to close past the first step, and the Escape / click-outside guards on
  // DialogContent below enforce the same thing. This is not the usual dialog contract, and the
  // reason is that both later steps have already changed server state: `ScanStep` verifies the new
  // factor, which replaces the old one, and then regenerates the backup codes, which invalidates
  // the set the user was holding. `CodesStep` is the only time the replacements are ever displayed.
  // A stray Escape between those two points would leave the account enrolled against an
  // authenticator the user has, with recovery codes nobody has seen.
  const handleOpenChange = (next: boolean) => {
    if (!next && step !== "confirm") return

    if (!next) reset()

    setOpen(next)
  }

  const handleDone = () => {
    setOpen(false)

    reset()

    toast.success(t("settings.security.reconfigured"), {
      description: t("settings.security.reconfiguredDescription")
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {t("settings.security.reconfigure")}
        </Button>
      </DialogTrigger>
      <DialogContent
        showCloseButton={step === "confirm"}
        onEscapeKeyDown={step !== "confirm" ? (event) => event.preventDefault() : undefined}
        onInteractOutside={step !== "confirm" ? (event) => event.preventDefault() : undefined}
      >
        {step === "confirm" && (
          <ConfirmStep
            onSuccess={(totpUri, password) => {
              setState({ totpUri, password })
              setStep("scan")
            }}
          />
        )}
        {step === "scan" && state.totpUri && state.password && (
          <ScanStep
            totpUri={state.totpUri}
            password={state.password}
            onSuccess={(backupCodes) => {
              setState((previousState) => ({ ...previousState, backupCodes }))
              setStep("codes")
            }}
          />
        )}
        {step === "codes" && state.backupCodes && (
          <CodesStep backupCodes={state.backupCodes} onDone={handleDone} />
        )}
      </DialogContent>
    </Dialog>
  )
}

export { TotpReconfigureDialog }
