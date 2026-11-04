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

  // Deliberately stays open past the first step, and the Escape / click-outside guards on
  // DialogContent below enforce the same thing. This is not the usual dialog contract, and it is not
  // about the account's safety before the codes step: `ConfirmStep`'s `enable` only holds the new
  // secret on the server (`lib/auth/totpReconfigure.ts`), and the old authenticator and saved
  // recovery codes keep working until `verifyTotp` accepts a code from the new one. The reasons are
  // these. Once `generateBackupCodes` has answered, `CodesStep` is the only place the replacement
  // codes are ever shown, so a stray close there leaves an account whose codes nobody has seen. A
  // stray close during the scan step leaves a useless entry for the same account label in the
  // user's authenticator app and discards the QR code and the password held in `ReconfigureState`.
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
