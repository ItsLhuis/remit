"use client"

import { useEffect, useState, useTransition } from "react"

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
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  NumberInput,
  Spinner,
  toast
} from "@/components/ui"

import { createTaxRate, updateTaxRate } from "../../mutations"
import {
  taxRateFormSchema,
  type TaxRateFormInputValues,
  type TaxRateFormValues,
  type TaxRateListItem
} from "../../schemas"

export type TaxRateFormState =
  | { mode: "create" }
  | { mode: "edit"; taxRate: TaxRateListItem }
  | null

const emptyTaxRateValues: TaxRateFormValues = {
  name: "",
  percentage: 0
}

type TaxRateFormDialogProps = {
  formState: TaxRateFormState
  onOpenChange: (open: boolean) => void
  onSaved: (taxRate: TaxRateListItem) => void
}

const TaxRateFormDialog = ({ formState, onOpenChange, onSaved }: TaxRateFormDialogProps) => {
  const { t } = useTranslation()

  const [serverError, setServerError] = useState<string | null>(null)

  const [isSaving, startSaving] = useTransition()

  const form = useForm<TaxRateFormInputValues, unknown, TaxRateFormValues>({
    resolver: zodResolver(taxRateFormSchema),
    mode: "onChange",
    defaultValues: emptyTaxRateValues
  })

  const { isDirty, isValid } = form.formState

  const isEdit = formState?.mode === "edit"

  useEffect(() => {
    if (!formState) return

    form.reset(
      formState.mode === "edit"
        ? { name: formState.taxRate.name, percentage: formState.taxRate.percentage }
        : emptyTaxRateValues
    )
  }, [formState, form])

  const submitDisabled = isSaving || !isValid || (isEdit && !isDirty)

  const onSubmit = (values: TaxRateFormValues) => {
    if (!formState || submitDisabled) return

    const target = formState

    setServerError(null)

    startSaving(async () => {
      const result =
        target.mode === "edit"
          ? await updateTaxRate({ id: target.taxRate.id, ...values })
          : await createTaxRate(values)

      if ("error" in result) {
        setServerError(result.error)

        return
      }

      onSaved(result.data.taxRate)

      toast.success(
        target.mode === "edit" ? t("settings.taxRates.updated") : t("settings.taxRates.created")
      )
    })
  }

  return (
    <Dialog
      open={Boolean(formState)}
      onOpenChange={(open) => {
        if (isSaving) return

        if (!open) setServerError(null)

        onOpenChange(open)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("settings.taxRates.editTitle") : t("settings.taxRates.createTitle")}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? t("settings.taxRates.editDescription")
              : t("settings.taxRates.createDescription")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
          <FieldGroup>
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>{t("settings.taxRates.name")}</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    placeholder={t("settings.taxRates.namePlaceholder")}
                    aria-invalid={fieldState.invalid}
                    disabled={isSaving}
                    autoComplete="off"
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              name="percentage"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>{t("settings.taxRates.percentage")}</FieldLabel>
                  <NumberInput
                    id={field.name}
                    name={field.name}
                    ref={field.ref}
                    value={Number.isNaN(field.value) ? "" : field.value}
                    onBlur={field.onBlur}
                    onChange={(event) =>
                      field.onChange(
                        event.target.value === "" ? Number.NaN : Number(event.target.value)
                      )
                    }
                    min={0}
                    max={100}
                    step={0.01}
                    inputMode="decimal"
                    aria-invalid={fieldState.invalid}
                    disabled={isSaving}
                  />
                  <FieldDescription>{t("settings.taxRates.percentageHelp")}</FieldDescription>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </FieldGroup>
          {serverError && <FieldError>{serverError}</FieldError>}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isSaving}>
                {t("common.actions.cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={submitDisabled}>
              {isSaving && <Spinner />}
              {isEdit ? t("settings.taxRates.saveEdit") : t("settings.taxRates.saveCreate")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export { TaxRateFormDialog }
