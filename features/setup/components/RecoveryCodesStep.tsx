"use client"

import { useEffect, useState } from "react"

import Image from "next/image"

import { useTranslation } from "@/lib/i18n"

import { Button, Checkbox, Label, RecoveryCodes, Typography } from "@/components/ui"

type RecoveryCodesStepProps = {
  backupCodes: string[]
  onComplete: () => void
}

const RecoveryCodesStep = ({ backupCodes, onComplete }: RecoveryCodesStepProps) => {
  const { t } = useTranslation()

  const [acknowledged, setAcknowledged] = useState(false)

  useEffect(() => {
    if (acknowledged) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }

    const handlePopState = () => {
      window.history.pushState(null, "", window.location.href)
    }

    window.history.pushState(null, "", window.location.href)

    window.addEventListener("beforeunload", handleBeforeUnload)
    window.addEventListener("popstate", handlePopState)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
      window.removeEventListener("popstate", handlePopState)
    }
  }, [acknowledged])

  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 flex flex-col items-center text-center">
        <Image src="/logo.png" alt={t("app.logoAlt")} width={64} height={64} className="mb-4" />
        <Typography variant="h2" className="mb-2">
          {t("backupCodes.title")}
        </Typography>
        <Typography variant="p" affects={["muted", "removePMargin"]}>
          {t("backupCodes.description")}
        </Typography>
      </div>
      <RecoveryCodes codes={backupCodes} className="mb-6" />
      <div className="mb-6 flex items-start gap-3">
        <Checkbox
          id="acknowledge"
          checked={acknowledged}
          onCheckedChange={(checked) => setAcknowledged(checked === true)}
        />
        <Label htmlFor="acknowledge" className="cursor-pointer leading-snug">
          {t("backupCodes.confirm")}
        </Label>
      </div>
      <Button size="lg" className="w-full" disabled={!acknowledged} onClick={onComplete}>
        {t("common.actions.continue")}
      </Button>
      <div className="mt-6 text-center">
        <Typography affects="small" className="text-muted-foreground">
          {t("setup.progress", { current: 4, total: 4 })}
        </Typography>
      </div>
    </div>
  )
}

export { RecoveryCodesStep }
