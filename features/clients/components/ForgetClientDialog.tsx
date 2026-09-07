"use client"

import { useState } from "react"

import Link from "next/link"

import { useTranslation } from "@/lib/i18n"

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldDescription,
  FieldLabel,
  Icon,
  Input,
  Spinner
} from "@/components/ui"

type ForgetClientDialogProps = {
  clientName: string
  open: boolean
  isForgetting: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (confirmation: string) => void
}

const ForgetClientDialog = ({
  clientName,
  open,
  isForgetting,
  onOpenChange,
  onConfirm
}: ForgetClientDialogProps) => {
  const { t } = useTranslation()

  const [confirmation, setConfirmation] = useState("")

  const matches = confirmation.trim() === clientName.trim()

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setConfirmation("")
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("clients.forget.title")}</DialogTitle>
          <DialogDescription>
            {t("clients.forget.description", { name: clientName })}
          </DialogDescription>
        </DialogHeader>
        <Alert variant="destructive">
          <Icon name="TriangleAlert" aria-hidden="true" />
          <AlertTitle>{t("clients.forget.warning")}</AlertTitle>
          <AlertDescription>
            <Link href="/settings/data" className="underline underline-offset-4">
              {t("clients.forget.exportPrompt")}
            </Link>
          </AlertDescription>
        </Alert>
        <Field>
          <FieldLabel htmlFor="forget-client-confirmation">
            {t("clients.forget.confirmationLabel", { name: clientName })}
          </FieldLabel>
          <Input
            id="forget-client-confirmation"
            value={confirmation}
            autoComplete="off"
            disabled={isForgetting}
            onChange={(event) => setConfirmation(event.target.value)}
          />
          <FieldDescription>{t("clients.forget.survives")}</FieldDescription>
        </Field>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isForgetting}>
              {t("common.actions.cancel")}
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={isForgetting || !matches}
            onClick={() => onConfirm(confirmation)}
          >
            {isForgetting && <Spinner />}
            {t("clients.forget.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { ForgetClientDialog }
