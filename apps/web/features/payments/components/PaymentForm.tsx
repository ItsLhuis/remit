"use client"

import { useMemo, useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import {
  Button,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FormDateField,
  FormTextField,
  Icon,
  Input,
  ScrollArea,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  Textarea,
  toast
} from "@/components/ui"

import { recordPayment, updatePayment } from "../mutations"
import {
  paymentFormSchema,
  MANUAL_PAYMENT_METHOD_VALUES,
  type PaymentFormInputValues
} from "../schemas"
import { type PaymentFormData } from "../types"

// Today in UTC, matching the boundary the schema pins `paidAt` to (`schemas.ts`). Deriving it in the
// browser's zone would offer a default date the server then files against a different day.
function getTodayInputValue(): string {
  return new Date().toISOString().slice(0, 10)
}

type PaymentFormProps = {
  onSuccess?: () => void
  onCancel?: () => void
} & (
  | { mode: "create"; invoiceId: string; defaultAmount: string; payment?: never }
  | { mode: "edit"; payment: PaymentFormData; invoiceId?: never; defaultAmount?: never }
)

const PaymentForm = (props: PaymentFormProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [serverError, setServerError] = useState<string | null>(null)
  const [isSaving, startSaving] = useTransition()

  const defaultValues = useMemo<PaymentFormInputValues>(() => {
    if (props.mode === "edit") return props.payment

    return {
      amount: props.defaultAmount,
      paidAt: getTodayInputValue(),
      method: "bank_transfer",
      reference: "",
      notes: ""
    }
  }, [props.mode, props.payment, props.defaultAmount])

  // `raw: true` because the server owns the transform. `paymentFormSchema` parses the amount into
  // cents and the date into a `Date`, but the action re-validates the very same payload with
  // `recordPaymentSchema`, which expects the strings the fields hold — the resolver's default
  // (`raw: false`) hands over the transformed output and the action rejects it at the trust boundary
  // with "expected string, received number". This keeps the schema as the single validation rule
  // while the wire format stays the form's own input shape.
  const form = useForm<PaymentFormInputValues>({
    resolver: zodResolver(paymentFormSchema, {}, { raw: true }),
    mode: "onBlur",
    defaultValues
  })

  const { isDirty, isValid } = form.formState

  const isEdit = props.mode === "edit"

  const submitDisabled = isSaving || !isValid || (isEdit && !isDirty)

  const onSubmit = (values: PaymentFormInputValues) => {
    if (submitDisabled) return

    setServerError(null)

    startSaving(async () => {
      const result = isEdit
        ? await updatePayment({ id: props.payment.id, ...values })
        : await recordPayment({ invoiceId: props.invoiceId, ...values })

      if ("error" in result) {
        setServerError(result.error)

        return
      }

      toast.success(isEdit ? t("payments.form.updated") : t("payments.form.recorded"))

      props.onSuccess?.()

      router.refresh()
    })
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
      className="flex min-h-0 flex-1 flex-col"
    >
      <ScrollArea className="min-h-0 flex-1">
        <FieldGroup className="grid gap-4 p-4">
          <Controller
            name="amount"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>{t("payments.fields.amount")}</FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  inputMode="decimal"
                  placeholder={t("payments.placeholders.amount")}
                  aria-invalid={fieldState.invalid}
                  disabled={isSaving}
                  className="text-right font-mono tabular-nums"
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <FormDateField
            control={form.control}
            name="paidAt"
            label={t("payments.fields.paidAt")}
            disabled={isSaving}
          />
          <Controller
            name="method"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>{t("payments.fields.method")}</FieldLabel>
                <Select value={field.value} onValueChange={field.onChange} disabled={isSaving}>
                  <SelectTrigger id={field.name} aria-invalid={fieldState.invalid}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {MANUAL_PAYMENT_METHOD_VALUES.map((method) => (
                        <SelectItem key={method} value={method}>
                          {t(`payments.method.${method}`)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <FormTextField
            control={form.control}
            name="reference"
            label={t("payments.fields.reference")}
            placeholder={t("payments.placeholders.reference")}
            disabled={isSaving}
          />
          <Controller
            name="notes"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>{t("payments.fields.notes")}</FieldLabel>
                <Textarea
                  {...field}
                  id={field.name}
                  placeholder={t("payments.placeholders.notes")}
                  aria-invalid={fieldState.invalid}
                  disabled={isSaving}
                  className="min-h-24"
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
        </FieldGroup>
      </ScrollArea>
      <div className="bg-muted/50 flex flex-col gap-3 border-t p-4">
        {serverError ? <FieldError>{serverError}</FieldError> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={props.onCancel} disabled={isSaving}>
            {t("common.actions.cancel")}
          </Button>
          <Button type="submit" disabled={submitDisabled}>
            {isSaving && <Spinner />}
            <Icon name="Save" aria-hidden="true" />
            {isEdit ? t("payments.form.saveEdit") : t("payments.form.saveCreate")}
          </Button>
        </div>
      </div>
    </form>
  )
}

export { PaymentForm }
