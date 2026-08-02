"use client"

import { useMemo, useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, useWatch } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import { isValidAmount, parseAmountToCents } from "@/lib/utils"

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
import {
  invoiceFormSchema,
  type InvoiceFormInputValues,
  type InvoiceFormValues
} from "../../schemas"
import {
  calculateInvoiceLineTotals,
  calculateInvoiceTotal,
  type InvoiceDiscount,
  type InvoiceLineItemInput
} from "../../services"
import { type InvoiceEditorData, type InvoiceFormData } from "../../types"

import { EMPTY_LINE_ITEM } from "./emptyLineItem"
import { FormSection } from "./FormSection"
import { InvoiceDetailsFields } from "./InvoiceDetailsFields"
import { InvoiceLineItemsField } from "./InvoiceLineItemsField"
import { InvoiceTotalsPanel } from "./InvoiceTotalsPanel"

// Mirrors the schema's coercion without its validation: the live totals panel has to price a row
// the moment it is typed, long before the row is valid, so an unparseable amount reads as zero
// rather than blocking the preview. The committed numbers always come from the server, which runs
// the same pure service over the parsed values.
function toCents(value: string): number {
  return isValidAmount(value) ? (parseAmountToCents(value) ?? 0) : 0
}

function toQuantity(value: string): number {
  const quantity = Number(value)

  return Number.isFinite(quantity) && quantity > 0 ? quantity : 0
}

function toPreviewLine(
  item: Partial<InvoiceFormInputValues["lineItems"][number]> | undefined,
  taxPercentages: Map<string, number>
): InvoiceLineItemInput {
  return {
    quantity: toQuantity(item?.quantity ?? ""),
    unitPriceCents: toCents(item?.unitPrice ?? ""),
    discount: toPreviewDiscount(item?.discountKind, item?.discountPercentage, item?.discountAmount),
    taxPercentage: taxPercentages.get(item?.taxRateId ?? "") ?? 0
  }
}

function toPreviewDiscount(
  kind: string | undefined,
  percentage: string | undefined,
  amount: string | undefined
): InvoiceDiscount | null {
  if (kind === "percentage") {
    const value = Number(percentage)

    return { type: "percentage", percentage: Number.isFinite(value) ? Math.min(value, 100) : 0 }
  }

  if (kind === "fixed") return { type: "fixed", amountCents: toCents(amount ?? "") }

  return null
}

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

  const form = useForm<InvoiceFormInputValues, unknown, InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema),
    // onChange, not onBlur: `submitDisabled` gates on `isValid`, which only leaves its initial
    // `false` once validation has run. Under onBlur a freshly filled form stays unsubmittable until
    // every field has also been blurred.
    mode: "onChange",
    defaultValues
  })

  const { isDirty, isValid } = form.formState

  const watched = useWatch({ control: form.control })

  const taxPercentages = useMemo(
    () => new Map(editor.taxRates.map((taxRate) => [taxRate.id, taxRate.percentage])),
    [editor.taxRates]
  )

  const previewLines = useMemo(
    () => (watched.lineItems ?? []).map((item) => toPreviewLine(item, taxPercentages)),
    [watched.lineItems, taxPercentages]
  )

  const previewDiscount = toPreviewDiscount(
    watched.discountKind,
    watched.discountPercentage,
    watched.discountAmount
  )

  const totals = calculateInvoiceTotal(previewLines, previewDiscount)
  const lineTotals = calculateInvoiceLineTotals(previewLines, previewDiscount)

  const currency = watched.currency ?? editor.defaults.defaultCurrency
  const locale = editor.defaults.defaultLocale

  const isEdit = invoice !== null

  const submitDisabled = isSaving || !isValid || (isEdit && !isDirty)

  const onSubmit = (values: InvoiceFormValues) => {
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
          discountKind={watched.discountKind ?? "none"}
          disabled={isSaving}
        />
      </FormSection>
      <Separator />
      <FormSection
        title={t("invoices.form.lineItemsSection")}
        description={t("invoices.form.lineItemsDescription")}
      >
        <InvoiceLineItemsField
          control={form.control}
          taxRates={editor.taxRates}
          currency={currency}
          locale={locale}
          lineTotalsCents={lineTotals.map((line) => line.totalCents)}
          discountKinds={(watched.lineItems ?? []).map((item) => item?.discountKind ?? "none")}
          errorMessage={form.formState.errors.lineItems?.message}
          disabled={isSaving}
        />
        <InvoiceTotalsPanel totals={totals} currency={currency} locale={locale} />
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
