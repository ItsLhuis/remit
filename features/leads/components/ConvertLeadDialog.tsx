"use client"

import { useState, useTransition } from "react"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import {
  Button,
  CurrencySelect,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldError,
  FieldLabel,
  Icon,
  Input,
  Spinner
} from "@/components/ui"

import { convertLeadToClient } from "../mutations"
import { convertLeadSchema, type ConvertLeadValues } from "../schemas"

type ConvertLeadDialogProps = {
  leadId: string
  defaultName: string
  defaultCurrency: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onConverted: (clientId: string) => void
}

const ConvertLeadDialog = ({
  leadId,
  defaultName,
  defaultCurrency,
  open,
  onOpenChange,
  onConverted
}: ConvertLeadDialogProps) => {
  const { t } = useTranslation()

  const [serverError, setServerError] = useState<string | null>(null)
  const [isConverting, startConverting] = useTransition()

  const form = useForm<ConvertLeadValues>({
    resolver: zodResolver(convertLeadSchema),
    mode: "onSubmit",
    defaultValues: { id: leadId, name: defaultName, currency: defaultCurrency }
  })

  const onSubmit = (values: ConvertLeadValues) => {
    if (isConverting) return

    setServerError(null)

    startConverting(async () => {
      const result = await convertLeadToClient(values)

      if ("error" in result) {
        setServerError(result.error)

        return
      }

      onConverted(result.data.clientId)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <DialogHeader>
            <DialogTitle>{t("leads.convert.title")}</DialogTitle>
            <DialogDescription>{t("leads.convert.description")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>{t("leads.convert.clientName")}</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    aria-invalid={fieldState.invalid}
                    disabled={isConverting}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              name="currency"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>{t("leads.convert.currency")}</FieldLabel>
                  <CurrencySelect
                    id={field.name}
                    ref={field.ref}
                    value={field.value}
                    onValueChangeAction={field.onChange}
                    valid={!fieldState.invalid}
                    disabled={isConverting}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            {serverError ? <FieldError>{serverError}</FieldError> : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isConverting}
              onClick={() => onOpenChange(false)}
            >
              {t("common.actions.cancel")}
            </Button>
            <Button type="submit" disabled={isConverting}>
              {isConverting ? <Spinner /> : <Icon name="UserPlus" aria-hidden="true" />}
              {t("leads.convert.confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export { ConvertLeadDialog }
