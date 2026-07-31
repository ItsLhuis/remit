"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldError,
  FieldLabel,
  Icon,
  Spinner,
  Textarea
} from "@/components/ui"

import { terminateContractReasonSchema, type TerminateContractReasonValues } from "../schemas"

type TerminateContractDialogProps = {
  open: boolean
  isTerminating: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (reason: string) => void
}

const TerminateContractDialog = ({
  open,
  isTerminating,
  onOpenChange,
  onConfirm
}: TerminateContractDialogProps) => {
  const { t } = useTranslation()

  const form = useForm<TerminateContractReasonValues>({
    resolver: zodResolver(terminateContractReasonSchema),
    mode: "onBlur",
    defaultValues: { terminationReason: "" }
  })

  const { isValid } = form.formState

  const onSubmit = (values: TerminateContractReasonValues) => {
    onConfirm(values.terminationReason)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("contracts.dialogs.terminate.title")}</DialogTitle>
          <DialogDescription>{t("contracts.dialogs.terminate.description")}</DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Controller
            name="terminationReason"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>
                  {t("contracts.dialogs.terminate.reasonLabel")}
                </FieldLabel>
                <Textarea
                  {...field}
                  id={field.name}
                  placeholder={t("contracts.dialogs.terminate.reasonPlaceholder")}
                  aria-invalid={fieldState.invalid}
                  disabled={isTerminating}
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isTerminating}>
                {t("common.actions.cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" variant="destructive" disabled={isTerminating || !isValid}>
              {isTerminating && <Spinner />}
              <Icon name="Ban" aria-hidden="true" />
              {t("contracts.dialogs.terminate.confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export { TerminateContractDialog }
