"use client"

import { useMemo, useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, useWatch } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import { formatCentsForInput } from "@/lib/utils"

import {
  Button,
  CurrencySelect,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FormTextField,
  Icon,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Spinner,
  Textarea,
  toast
} from "@/components/ui"

import { createRecurringInvoice, updateRecurringInvoice } from "../../mutations"
import { recurringInvoiceFormSchema, type RecurringInvoiceFormInputValues } from "../../schemas"
import { type RecurringInvoiceDetail, type RecurringInvoiceEditorData } from "../../types"

import { EMPTY_LINE_ITEM } from "./emptyLineItem"
import { FormSection } from "./FormSection"
import { RecurringInvoiceLineItemsField } from "./RecurringInvoiceLineItemsField"
import { RecurringInvoiceRetainerSection } from "./RecurringInvoiceRetainerSection"
import { RecurringInvoiceScheduleSection } from "./RecurringInvoiceScheduleSection"
import { fromSelectValue, toSelectValue, NO_SELECTION } from "./selectSentinel"

// Read back through UTC getters because the schema writes these columns as UTC midnight
// (`T00:00:00.000Z` in schemas.ts). `formatIsoDay` reads local ones, so using it here would print
// the previous day everywhere west of Greenwich and walk the date backwards on every save.
function toDateInput(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : ""
}

function toNumberInput(value: number | null): string {
  return value === null ? "" : String(value)
}

function toLineItemInputs(
  schedule: RecurringInvoiceDetail
): RecurringInvoiceFormInputValues["lineItems"] {
  return schedule.lineItems.map((line) => ({
    description: line.description,
    unit: line.unit ?? "",
    quantity: String(line.quantity),
    unitPrice: formatCentsForInput(line.unitPriceCents),
    taxRateId: line.taxRateId ?? "",
    discountKind: line.discountType ?? "none",
    discountPercentage: toNumberInput(line.discountPercentage),
    discountAmount: formatCentsForInput(line.discountAmountCents)
  }))
}

// The end condition exists only in the form: the table stores the answer across two independently
// nullable columns, so which one is populated is what the editor reads the discriminator back from.
function toDefaultValues(data: RecurringInvoiceEditorData): RecurringInvoiceFormInputValues {
  const { schedule } = data

  if (!schedule) {
    const defaultTaxRate = data.taxRateOptions.find((taxRate) => taxRate.isDefault)

    return {
      name: "",
      clientId: "",
      projectId: "",
      templateId: "",
      cadence: "monthly",
      cadenceDay: "",
      nextRunAt: "",
      endCondition: "never",
      endAfterCount: "",
      endByDate: "",
      autoSend: false,
      currency: data.defaults.defaultCurrency,
      includedHours: "",
      overageRate: "",
      notes: "",
      lineItems: [{ ...EMPTY_LINE_ITEM, taxRateId: defaultTaxRate?.id ?? "" }]
    }
  }

  return {
    name: schedule.name,
    clientId: schedule.clientId,
    projectId: schedule.projectId ?? "",
    templateId: schedule.templateId ?? "",
    cadence: schedule.cadence,
    cadenceDay: toNumberInput(schedule.cadenceDay),
    nextRunAt: toDateInput(schedule.nextRunAt),
    endCondition:
      schedule.endAfterCount !== null
        ? "after_count"
        : schedule.endByDate !== null
          ? "by_date"
          : "never",
    endAfterCount: toNumberInput(schedule.endAfterCount),
    endByDate: toDateInput(schedule.endByDate),
    autoSend: schedule.autoSend,
    currency: schedule.currency,
    includedHours: toNumberInput(schedule.includedHours),
    overageRate: formatCentsForInput(schedule.overageRateCents),
    notes: schedule.notes,
    lineItems: toLineItemInputs(schedule)
  }
}

type RecurringInvoiceFormProps = {
  data: RecurringInvoiceEditorData
}

const RecurringInvoiceForm = ({ data }: RecurringInvoiceFormProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [serverError, setServerError] = useState<string | null>(null)
  const [isSaving, startSaving] = useTransition()

  const defaultValues = useMemo(() => toDefaultValues(data), [data])

  const form = useForm<RecurringInvoiceFormInputValues>({
    // `raw: true`, so the values that reach `onSubmit` are the strings the controls hold rather
    // than the schema's transformed output. createRecurringInvoice re-validates with a schema built
    // from the same string-input shape (schemas.ts's recurringInvoiceFieldsShape), so sending the
    // transformed cents, numbers and Dates would fail that re-parse at the trust boundary.
    resolver: zodResolver(recurringInvoiceFormSchema, {}, { raw: true }),
    // onChange, not onBlur: `submitDisabled` gates on `isValid`, which only leaves its initial
    // `false` once validation has run. Under onBlur a freshly filled form stays unsubmittable until
    // every field has also been blurred.
    mode: "onChange",
    defaultValues
  })

  const { isDirty, isValid } = form.formState

  // Named field, never the whole form: the project list is the only thing that follows the client.
  const clientId = useWatch({ control: form.control, name: "clientId" })

  const projectOptions = useMemo(
    () => data.projectOptions.filter((project) => project.clientId === clientId),
    [data.projectOptions, clientId]
  )

  const schedule = data.schedule
  const isEdit = schedule !== null

  const retainerEnabled = defaultValues.includedHours !== "" || defaultValues.overageRate !== ""

  const submitDisabled = isSaving || !isValid || (isEdit && !isDirty)

  // A project belongs to exactly one client and `assertParentsExist` in mutations.ts rejects a
  // schedule whose project is another client's, so the previous project cannot survive a change of
  // client.
  const handleClientChange = (value: string) => {
    form.setValue("clientId", value, { shouldDirty: true, shouldValidate: true })
    form.setValue("projectId", "", { shouldDirty: true, shouldValidate: true })
  }

  const onSubmit = (values: RecurringInvoiceFormInputValues) => {
    if (submitDisabled) return

    setServerError(null)

    startSaving(async () => {
      const result = schedule
        ? await updateRecurringInvoice({ id: schedule.id, ...values })
        : await createRecurringInvoice(values)

      if ("error" in result) {
        setServerError(result.error)

        return
      }

      toast.success(
        isEdit ? t("recurringInvoices.toasts.updated") : t("recurringInvoices.toasts.created")
      )

      router.push(`/recurring-invoices/${result.data.id}`)
      router.refresh()
    })
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <FormSection title={t("recurringInvoices.form.sections.details")}>
        <FieldGroup className="grid gap-4">
          <FormTextField
            control={form.control}
            name="name"
            label={t("recurringInvoices.fields.name")}
            disabled={isSaving}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              name="clientId"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>
                    {t("recurringInvoices.fields.client")}
                  </FieldLabel>
                  <Select
                    value={field.value}
                    onValueChange={handleClientChange}
                    disabled={isSaving}
                  >
                    <SelectTrigger id={field.name} aria-invalid={fieldState.invalid}>
                      <SelectValue placeholder={t("recurringInvoices.fields.client")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {data.clientOptions.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              name="projectId"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>
                    {t("recurringInvoices.fields.project")}
                  </FieldLabel>
                  <Select
                    value={toSelectValue(field.value)}
                    onValueChange={(value) => field.onChange(fromSelectValue(value))}
                    disabled={isSaving}
                  >
                    <SelectTrigger id={field.name} aria-invalid={fieldState.invalid}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value={NO_SELECTION}>
                          {t("recurringInvoices.detail.noProject")}
                        </SelectItem>
                        {projectOptions.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              name="templateId"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>
                    {t("recurringInvoices.fields.template")}
                  </FieldLabel>
                  <Select
                    value={toSelectValue(field.value)}
                    onValueChange={(value) => field.onChange(fromSelectValue(value))}
                    disabled={isSaving}
                  >
                    <SelectTrigger id={field.name} aria-invalid={fieldState.invalid}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value={NO_SELECTION}>{t("invoices.template.none")}</SelectItem>
                        {data.templateOptions.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              name="currency"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>
                    {t("recurringInvoices.fields.currency")}
                  </FieldLabel>
                  <CurrencySelect
                    id={field.name}
                    ref={field.ref}
                    value={field.value}
                    onValueChangeAction={field.onChange}
                    valid={!fieldState.invalid}
                    disabled={isSaving}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </div>
        </FieldGroup>
      </FormSection>
      <Separator />
      <FormSection title={t("recurringInvoices.form.sections.schedule")}>
        <RecurringInvoiceScheduleSection control={form.control} disabled={isSaving} />
      </FormSection>
      <Separator />
      <FormSection title={t("recurringInvoices.form.sections.retainer")}>
        <RecurringInvoiceRetainerSection
          control={form.control}
          setValue={form.setValue}
          defaultEnabled={retainerEnabled}
          disabled={isSaving}
        />
      </FormSection>
      <Separator />
      <FormSection title={t("recurringInvoices.form.sections.lineItems")}>
        <RecurringInvoiceLineItemsField
          control={form.control}
          taxRates={data.taxRateOptions}
          errorMessage={form.formState.errors.lineItems?.message}
          disabled={isSaving}
        />
      </FormSection>
      <Separator />
      <FormSection title={t("recurringInvoices.form.sections.notes")}>
        <Controller
          name="notes"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>{t("recurringInvoices.fields.notes")}</FieldLabel>
              <Textarea
                {...field}
                id={field.name}
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
            {t("recurringInvoices.form.cancel")}
          </Button>
          <Button type="submit" disabled={submitDisabled}>
            {isSaving && <Spinner />}
            <Icon name="Save" aria-hidden="true" />
            {isEdit
              ? t("recurringInvoices.form.submitEdit")
              : t("recurringInvoices.form.submitCreate")}
          </Button>
        </div>
      </div>
    </form>
  )
}

export { RecurringInvoiceForm }
