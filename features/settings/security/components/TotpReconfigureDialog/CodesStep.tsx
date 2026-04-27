"use client"

import { Fragment, useState } from "react"

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
  const [acknowledged, setAcknowledged] = useState(false)

  return (
    <Fragment>
      <DialogHeader>
        <DialogTitle>Save your new recovery codes</DialogTitle>
        <DialogDescription>
          Your previous recovery codes are now invalid. Store these in a safe place &mdash; they
          won&apos;t be shown again.
        </DialogDescription>
      </DialogHeader>
      <RecoveryCodes codes={backupCodes} />
      <div className="flex items-start gap-3">
        <Checkbox
          id="acknowledge"
          checked={acknowledged}
          onCheckedChange={(checked) => setAcknowledged(checked === true)}
        />
        <Label htmlFor="acknowledge" className="cursor-pointer leading-snug">
          I have saved my recovery codes in a safe place.
        </Label>
      </div>
      <DialogFooter>
        <Button className="w-full sm:w-auto" disabled={!acknowledged} onClick={onDone}>
          Done
        </Button>
      </DialogFooter>
    </Fragment>
  )
}

export { CodesStep }
