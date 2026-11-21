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
  toast
} from "@/components/ui"

import { createInvoice, updateInvoice } from "../../mutations"
import { invoiceFormSchema, type InvoiceFormInputValues } from "../../schemas"
import { type InvoiceEditorData, type InvoiceFormData } from "../../types"

import { EMPTY_LINE_ITEM } from "./emptyLineItem"
import { FormSection } from "./FormSection"
import { InvoiceDetailsFields } from "./InvoiceDetailsFields"
import { InvoicePricingSection } from "./InvoicePricingSection"

type InvoiceFormProps = {
  editor: InvoiceEditorData
  invoice: InvoiceFormData | null
}

const InvoiceForm = ({ editor, invoice }: InvoiceFormProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [serverError, setServerError] = useState<string | null>(null)
  const [isSaving, startSaving] = useTransition()

  const defaultValues = useMemo<InvoiceFormInputValues>(() => {
    if (invoice) return invoice

    const defaultTaxRate = editor.taxRates.find((taxRate) => taxRate.isDefault)

    return {
      currency: editor.defaults.defaultCurrency,
      templateId: "",
      // Both dates stay empty on a new draft: the send action stamps the issue date and derives the
      // due date from payment terms, so pre-filling them here would only invite a stale pair.
      issueDate: "",
      dueDate: "",
      notes: editor.defaults.defaultNotesInvoice,
      discountKind: "none",
      discountPercentage: "",
      discountAmount: "",
      lineItems: [{ ...EMPTY_LINE_ITEM, taxRateId: defaultTaxRate?.id ?? "" }]
    }
  }, [invoice, editor.taxRates, editor.defaults])

  const form = useForm<InvoiceFormInputValues>({
    // `raw: true`, so the values that reach `onSubmit` are the strings the controls hold rather
    // than the schema's transformed output. createInvoice re-validates with a schema built from
    // the same string-input shape (schemas.ts's invoiceFieldsShape), so sending the transformed
    // cents and Dates would fail that re-parse at the trust boundary.
    resolver: zodResolver(invoiceFormSchema, {}, { raw: true }),
    // onChange, not onBlur: `submitDisabled` gates on `isValid`, which only leaves its initial
    // `false` once validation has run. Under onBlur a freshly filled form stays unsubmittable until
    // every field has also been blurred.
    mode: "onChange",
    defaultValues
  })

  const { isDirty, isValid } = form.formState

  const isEdit = invoice !== null

  const submitDisabled = isSaving || !isValid || (isEdit && !isDirty)

  const onSubmit = (values: InvoiceFormInputValues) => {
    if (submitDisabled) return

    setServerError(null)

    startSaving(async () => {
      const result = invoice
        ? await updateInvoice({ id: invoice.id, ...values })
        : await createInvoice({ projectId: editor.projectId, ...values })

      if ("error" in result) {
        setServerError(result.error)

        return
      }

      toast.success(
        isEdit ? t("invoices.notifications.updated") : t("invoices.notifications.created")
      )

      router.push(`/projects/${editor.projectId}/invoices/${result.data.invoice.id}`)
      router.refresh()
    })
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <FormSection
        title={t("invoices.form.detailsSection")}
        description={t("invoices.form.detailsDescription")}
      >
        <InvoiceDetailsFields
          control={form.control}
          templates={editor.templates}
          disabled={isSaving}
        />
      </FormSection>
      <Separator />
      <FormSection
        title={t("invoices.form.lineItemsSection")}
        description={t("invoices.form.lineItemsDescription")}
      >
        <InvoicePricingSection
          control={form.control}
          taxRates={editor.taxRates}
          defaultCurrency={editor.defaults.defaultCurrency}
          locale={editor.defaults.defaultLocale}
          errorMessage={form.formState.errors.lineItems?.message}
          disabled={isSaving}
        />
      </FormSection>
      <Separator />
      <FormSection
        title={t("invoices.form.notesSection")}
        description={t("invoices.form.notesDescription")}
      >
        <Controller
          name="notes"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>{t("invoices.fields.notes")}</FieldLabel>
              <Textarea
                {...field}
                id={field.name}
                placeholder={t("invoices.placeholders.notes")}
                aria-invalid={fieldState.invalid}
                disabled={isSaving}
                className="min-h-28"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FormSection>
      <div className="flex flex-col gap-3">
        {serverError ? <FieldError>{serverError}</FieldError> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSaving}>
            {t("common.actions.cancel")}
          </Button>
          <Button type="submit" disabled={submitDisabled}>
            {isSaving && <Spinner />}
            <Icon name="Save" aria-hidden="true" />
            {isEdit ? t("invoices.form.saveEdit") : t("invoices.form.saveCreate")}
          </Button>
        </div>
      </div>
    </form>
  )
}

export { InvoiceForm }
