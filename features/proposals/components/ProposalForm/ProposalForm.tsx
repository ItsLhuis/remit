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

import { createProposal, updateProposal } from "../../mutations"
import { proposalFormSchema, type ProposalFormInputValues } from "../../schemas"
import { type ProposalEditorData, type ProposalFormData } from "../../types"

import { EMPTY_LINE_ITEM } from "./emptyLineItem"
import { FormSection } from "./FormSection"
import { ProposalDetailsFields } from "./ProposalDetailsFields"
import { ProposalParentFields } from "./ProposalParentFields"
import { ProposalPricingSection } from "./ProposalPricingSection"

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
      projectId: editor.projectId ?? "",
      clientId: "",
      currency: editor.defaults.defaultCurrency,
      templateId: "",
      validUntil: "",
      notes: editor.defaults.defaultNotesProposal,
      discountKind: "none",
      discountPercentage: "",
      discountAmount: "",
      lineItems: [{ ...EMPTY_LINE_ITEM, taxRateId: defaultTaxRate?.id ?? "" }]
    }
  }, [proposal, editor.projectId, editor.taxRates, editor.defaults])

  const form = useForm<ProposalFormInputValues>({
    // `raw: true`, so the values that reach `onSubmit` are the strings the controls hold rather
    // than the schema's transformed output. createProposal re-validates with a schema built from
    // the same string-input shape (schemas.ts's proposalFieldsShape), so sending the transformed
    // cents and Dates would fail that re-parse at the trust boundary.
    resolver: zodResolver(proposalFormSchema, {}, { raw: true }),
    // onChange, not onBlur: `submitDisabled` gates on `isValid`, which only leaves its initial
    // `false` once validation has run. Under onBlur a freshly filled form stays unsubmittable until
    // every field has also been blurred.
    mode: "onChange",
    defaultValues
  })

  const { isDirty, isValid } = form.formState

  const isEdit = proposal !== null

  const submitDisabled = isSaving || !isValid || (isEdit && !isDirty)

  const onSubmit = (values: ProposalFormInputValues) => {
    if (submitDisabled) return

    setServerError(null)

    startSaving(async () => {
      const result = proposal
        ? await updateProposal({ id: proposal.id, ...values })
        : await createProposal(values)

      if ("error" in result) {
        setServerError(result.error)

        return
      }

      toast.success(
        isEdit ? t("proposals.notifications.updated") : t("proposals.notifications.created")
      )

      router.push(`/proposals/${result.data.proposal.id}`)
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
          disabled={isSaving}
        />
      </FormSection>
      <Separator />
      <FormSection
        title={t("proposals.form.parentSection")}
        description={t("proposals.form.parentDescription")}
      >
        <ProposalParentFields
          control={form.control}
          projects={editor.parentOptions.projects}
          clients={editor.parentOptions.clients}
          disabled={isSaving}
        />
      </FormSection>
      <Separator />
      <FormSection
        title={t("proposals.form.lineItemsSection")}
        description={t("proposals.form.lineItemsDescription")}
      >
        <ProposalPricingSection
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
