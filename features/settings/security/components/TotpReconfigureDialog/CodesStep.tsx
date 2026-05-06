"use client"

import { Fragment, useState } from "react"

import { useTranslation } from "@/lib/i18n"

import {
  Button,
  Checkbox,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  RecoveryCodes
} from "@/components/ui"

type CodesStepProps = {
  backupCodes: string[]
  onDone: () => void
}

const CodesStep = ({ backupCodes, onDone }: CodesStepProps) => {
  const { t } = useTranslation()

  const [acknowledged, setAcknowledged] = useState(false)

  return (
    <Fragment>
      <DialogHeader>
        <DialogTitle>{t("backupCodes.title")}</DialogTitle>
        <DialogDescription>{t("backupCodes.description")}</DialogDescription>
      </DialogHeader>
      <RecoveryCodes codes={backupCodes} />
      <div className="flex items-start gap-3">
        <Checkbox
          id="acknowledge"
          checked={acknowledged}
          onCheckedChange={(checked) => setAcknowledged(checked === true)}
        />
        <Label htmlFor="acknowledge" className="cursor-pointer leading-snug">
          {t("backupCodes.confirm")}
        </Label>
      </div>
      <DialogFooter>
        <Button className="w-full sm:w-auto" disabled={!acknowledged} onClick={onDone}>
          {t("common.actions.done")}
        </Button>
      </DialogFooter>
    </Fragment>
  )
}

export { CodesStep }
