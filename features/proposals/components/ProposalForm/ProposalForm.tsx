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

import { createProposal, updateProposal } from "../../mutations"
import {
  proposalFormSchema,
  type ProposalFormInputValues,
  type ProposalFormValues
} from "../../schemas"
import {
  calculateProposalLineTotals,
  calculateProposalTotal,
  type ProposalDiscount,
  type ProposalLineItemInput
} from "../../services"
import { type ProposalEditorData, type ProposalFormData } from "../../types"

import { EMPTY_LINE_ITEM } from "./emptyLineItem"
import { FormSection } from "./FormSection"
import { ProposalDetailsFields } from "./ProposalDetailsFields"
import { ProposalLineItemsField } from "./ProposalLineItemsField"
import { ProposalTotalsPanel } from "./ProposalTotalsPanel"

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
  item: Partial<ProposalFormInputValues["lineItems"][number]> | undefined,
  taxPercentages: Map<string, number>
): ProposalLineItemInput {
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
): ProposalDiscount | null {
  if (kind === "percentage") {
    const value = Number(percentage)

    return { type: "percentage", percentage: Number.isFinite(value) ? Math.min(value, 100) : 0 }
  }

  if (kind === "fixed") return { type: "fixed", amountCents: toCents(amount ?? "") }

  return null
}

type ProposalFormProps = {
  editor: ProposalEditorData
  proposal: ProposalFormData | null
}

const ProposalForm = ({ editor, proposal }: ProposalFormProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [serverError, setServerError] = useState<string | null>(null)
  const [isSaving, startSaving] = useTransition()

  const defaultValues = useMemo<ProposalFormInputValues>(() => {
    if (proposal) return proposal

    const defaultTaxRate = editor.taxRates.find((taxRate) => taxRate.isDefault)

    return {
      currency: editor.defaults.defaultCurrency,
      templateId: "",
      validUntil: "",
      notes: editor.defaults.defaultNotesProposal,
      discountKind: "none",
      discountPercentage: "",
      discountAmount: "",
      lineItems: [{ ...EMPTY_LINE_ITEM, taxRateId: defaultTaxRate?.id ?? "" }]
    }
  }, [proposal, editor.taxRates, editor.defaults])

  const form = useForm<ProposalFormInputValues, unknown, ProposalFormValues>({
    resolver: zodResolver(proposalFormSchema),
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

  const totals = calculateProposalTotal(previewLines, previewDiscount)
  const lineTotals = calculateProposalLineTotals(previewLines, previewDiscount)

  const currency = watched.currency ?? editor.defaults.defaultCurrency
  const locale = editor.defaults.defaultLocale

  const isEdit = proposal !== null

  const submitDisabled = isSaving || !isValid || (isEdit && !isDirty)

  const onSubmit = (values: ProposalFormValues) => {
    if (submitDisabled) return

    setServerError(null)

    startSaving(async () => {
      const result = proposal
        ? await updateProposal({ id: proposal.id, ...values })
        : await createProposal({ projectId: editor.projectId, ...values })

      if ("error" in result) {
        setServerError(result.error)

        return
      }

      toast.success(
        isEdit ? t("proposals.notifications.updated") : t("proposals.notifications.created")
      )

      router.push(`/projects/${editor.projectId}/proposals/${result.data.proposal.id}`)
      router.refresh()
    })
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <FormSection
        title={t("proposals.form.detailsSection")}
        description={t("proposals.form.detailsDescription")}
      >
        <ProposalDetailsFields
          control={form.control}
          templates={editor.templates}
          discountKind={watched.discountKind ?? "none"}
          disabled={isSaving}
        />
      </FormSection>
      <Separator />
      <FormSection
        title={t("proposals.form.lineItemsSection")}
        description={t("proposals.form.lineItemsDescription")}
      >
        <ProposalLineItemsField
          control={form.control}
          taxRates={editor.taxRates}
          currency={currency}
          locale={locale}
          lineTotalsCents={lineTotals.map((line) => line.totalCents)}
          discountKinds={(watched.lineItems ?? []).map((item) => item?.discountKind ?? "none")}
          errorMessage={form.formState.errors.lineItems?.message}
          disabled={isSaving}
        />
        <ProposalTotalsPanel totals={totals} currency={currency} locale={locale} />
      </FormSection>
      <Separator />
      <FormSection
        title={t("proposals.form.notesSection")}
        description={t("proposals.form.notesDescription")}
      >
        <Controller
          name="notes"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>{t("proposals.fields.notes")}</FieldLabel>
              <Textarea
                {...field}
                id={field.name}
                placeholder={t("proposals.placeholders.notes")}
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
            {isEdit ? t("proposals.form.saveEdit") : t("proposals.form.saveCreate")}
          </Button>
        </div>
      </div>
    </form>
  )
}

export { ProposalForm }
