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
  FieldLabel,
  Icon,
  Separator,
  Spinner,
  Textarea,
  Typography,
  toast
} from "@/components/ui"

import { createCreditNote } from "../../mutations"
import { creditNoteFormSchema, type CreditNoteFormInputValues } from "../../schemas"
import { type CreditNoteEditorData } from "../../types"

import { CreditNotePricingSection } from "./CreditNotePricingSection"
import { EMPTY_LINE_ITEM } from "./emptyLineItem"

type CreditNoteFormProps = {
  editor: CreditNoteEditorData
}

// Create-only, unlike the invoice form. A credit note is issued the moment it is written — there is
// no draft state in `credit_notes` to revise — so the document is corrected by deleting it and
// issuing another, which is why there is no edit path to share this form with.
const CreditNoteForm = ({ editor }: CreditNoteFormProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [serverError, setServerError] = useState<string | null>(null)
  const [isSaving, startSaving] = useTransition()

  const defaultValues = useMemo<CreditNoteFormInputValues>(() => {
    const defaultTaxRate = editor.taxRates.find((taxRate) => taxRate.isDefault)

    return {
      reason: "",
      lineItems: [{ ...EMPTY_LINE_ITEM, taxRateId: defaultTaxRate?.id ?? "" }]
    }
  }, [editor.taxRates])

  const form = useForm<CreditNoteFormInputValues>({
    // `raw: true`, so the values that reach `onSubmit` are the strings the controls hold rather than
    // the schema's transformed output. createCreditNote re-validates with a schema built from the
    // same string-input shape (schemas.ts's creditNoteFieldsShape), so sending the transformed cents
    // would fail that re-parse at the trust boundary.
    resolver: zodResolver(creditNoteFormSchema, {}, { raw: true }),
    // onChange, not onBlur: `submitDisabled` gates on `isValid`, which only leaves its initial
    // `false` once validation has run.
    mode: "onChange",
    defaultValues
  })

  const { isValid } = form.formState

  const submitDisabled = isSaving || !isValid

  const listHref = editor.projectId
    ? `/projects/${editor.projectId}/invoices/${editor.invoiceId}`
    : "/invoices"

  const onSubmit = (values: CreditNoteFormInputValues) => {
    if (submitDisabled) return

    setServerError(null)

    startSaving(async () => {
      const result = await createCreditNote({ invoiceId: editor.invoiceId, ...values })

      if ("error" in result) {
        setServerError(result.error)

        return
      }

      toast.success(t("creditNotes.notifications.created"))

      router.push(
        editor.projectId
          ? `/projects/${editor.projectId}/invoices/${editor.invoiceId}/credit-notes/${result.data.id}`
          : "/credit-notes"
      )
      router.refresh()
    })
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <section className="flex flex-col gap-4">
        <div className="space-y-0.5">
          <Typography variant="p" affects={["medium", "removePMargin"]}>
            {t("creditNotes.form.lineItemsSection")}
          </Typography>
          <Typography variant="p" affects={["muted", "small", "removePMargin"]}>
            {t("creditNotes.form.lineItemsDescription", { currency: editor.currency })}
          </Typography>
        </div>
        <CreditNotePricingSection
          control={form.control}
          taxRates={editor.taxRates}
          currency={editor.currency}
          locale={editor.defaults.defaultLocale}
          outstandingCents={editor.outstandingCents}
          errorMessage={form.formState.errors.lineItems?.message}
          disabled={isSaving}
        />
      </section>
      <Separator />
      <section className="flex flex-col gap-4">
        <div className="space-y-0.5">
          <Typography variant="p" affects={["medium", "removePMargin"]}>
            {t("creditNotes.form.reasonSection")}
          </Typography>
          <Typography variant="p" affects={["muted", "small", "removePMargin"]}>
            {t("creditNotes.form.reasonDescription")}
          </Typography>
        </div>
        <Controller
          name="reason"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>{t("creditNotes.fields.reason")}</FieldLabel>
              <Textarea
                {...field}
                id={field.name}
                placeholder={t("creditNotes.placeholders.reason")}
                aria-invalid={fieldState.invalid}
                disabled={isSaving}
                className="min-h-28"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </section>
      <div className="flex flex-col gap-3">
        {serverError ? <FieldError>{serverError}</FieldError> : null}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(listHref)}
            disabled={isSaving}
          >
            {t("common.actions.cancel")}
          </Button>
          <Button type="submit" disabled={submitDisabled}>
            {isSaving && <Spinner />}
            <Icon name="Save" aria-hidden="true" />
            {t("creditNotes.form.saveCreate")}
          </Button>
        </div>
      </div>
    </form>
  )
}

export { CreditNoteForm }
