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
