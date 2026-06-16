"use client"

import { Fragment, useMemo, useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, type FieldPath, useForm } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import {
  Button,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  Icon,
  Input,
  PhoneInput,
  ScrollArea,
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

import { createLead, updateLead } from "../../mutations"
import {
  leadFormSchema,
  LEAD_STATUS_VALUES,
  type LeadFormValues,
  type LeadStatus
} from "../../schemas"
import { type LeadFormData } from "../../types"

import { FormSection } from "./FormSection"

type LeadFormCallbacks = {
  onSuccess?: (lead: { id: string }) => void
  onCancel?: () => void
  layout?: "page" | "panel"
}

type LeadFormProps = LeadFormCallbacks &
  (
    | { mode: "create"; lead?: never; currentStatus?: never }
    | { mode: "edit"; lead: LeadFormData; currentStatus: LeadStatus }
  )

const EMPTY_LEAD_FORM: LeadFormValues = {
  firstName: "",
  lastName: "",
  company: "",
  email: "",
  phone: "",
  source: "",
  notes: "",
  lostReason: ""
}

const LeadForm = (props: LeadFormProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [serverError, setServerError] = useState<string | null>(null)
  const [status, setStatus] = useState<LeadStatus>("new")
  const [isSaving, startSaving] = useTransition()

  const defaultValues = useMemo<LeadFormValues>(
    () => (props.mode === "edit" ? props.lead : EMPTY_LEAD_FORM),
    [props]
  )

  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    mode: "onChange",
    defaultValues
  })

  const { isDirty, isValid } = form.formState

  const isEdit = props.mode === "edit"

  const layout = props.layout ?? "page"

  const showLostReason = isEdit ? props.currentStatus === "lost" : status === "lost"

  const submitDisabled = isSaving || !isValid || (isEdit && !isDirty)

  const onSubmit = (values: LeadFormValues) => {
    if (submitDisabled) return

    if (!isEdit && status === "lost" && values.lostReason.trim().length === 0) {
      form.setError("lostReason", { message: t("leads.validation.lostReasonRequired") })

      return
    }

    setServerError(null)

    startSaving(async () => {
      const result = isEdit
        ? await updateLead({ id: props.lead.id, ...values })
        : await createLead({ ...values, status })

      if ("error" in result) {
        setServerError(result.error)

        return
      }

      toast.success(isEdit ? t("leads.form.updated") : t("leads.form.created"))

      if (props.onSuccess) {
        props.onSuccess(result.data.lead)

        return
      }

      router.push(`/leads/${result.data.lead.id}`)
      router.refresh()
    })
  }

  const onCancel = () => {
    if (props.onCancel) {
      props.onCancel()

      return
    }

    router.back()
  }

  const renderTextField = ({
    name,
    label,
    placeholder,
    type = "text",
    autoComplete
  }: {
    name: FieldPath<LeadFormValues>
    label: string
    placeholder?: string
    type?: string
    autoComplete?: string
  }) => (
    <Controller
      name={name}
      control={form.control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
          <Input
            {...field}
            id={field.name}
            type={type}
            placeholder={placeholder}
            autoComplete={autoComplete}
            aria-invalid={fieldState.invalid}
            disabled={isSaving}
          />
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  )

  const fields = (
    <Fragment>
      <FormSection
        title={t("leads.form.contactSection")}
        description={t("leads.form.contactDescription")}
      >
        <FieldGroup className="grid gap-4">
          {renderTextField({
            name: "firstName",
            label: t("leads.fields.firstName"),
            placeholder: t("leads.placeholders.firstName"),
            autoComplete: "given-name"
          })}
          {renderTextField({
            name: "lastName",
            label: t("leads.fields.lastName"),
            placeholder: t("leads.placeholders.lastName"),
            autoComplete: "family-name"
          })}
          {renderTextField({
            name: "company",
            label: t("leads.fields.company"),
            placeholder: t("leads.placeholders.company"),
            autoComplete: "organization"
          })}
          {renderTextField({
            name: "email",
            label: t("leads.fields.email"),
            placeholder: t("leads.placeholders.email"),
            type: "email",
            autoComplete: "email"
          })}
          <Controller
            name="phone"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>{t("leads.fields.phone")}</FieldLabel>
                <PhoneInput
                  id={field.name}
                  name={field.name}
                  ref={field.ref}
                  value={field.value}
                  onBlur={field.onBlur}
                  onValueChangeAction={field.onChange}
                  valid={!fieldState.invalid}
                  disabled={isSaving}
                  placeholder={t("leads.placeholders.phone")}
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
        </FieldGroup>
      </FormSection>
      <Separator />
      <FormSection
        title={t("leads.form.pipelineSection")}
        description={t("leads.form.pipelineDescription")}
      >
        <FieldGroup className="grid gap-4">
          {renderTextField({
            name: "source",
            label: t("leads.fields.source"),
            placeholder: t("leads.placeholders.source")
          })}
          {!isEdit ? (
            <Field>
              <FieldLabel htmlFor="lead-status">{t("leads.fields.status")}</FieldLabel>
              <Select value={status} onValueChange={(value) => setStatus(value as LeadStatus)}>
                <SelectTrigger id="lead-status" disabled={isSaving}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {LEAD_STATUS_VALUES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {t(`leads.status.${value}`)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          ) : null}
          {showLostReason ? (
            <Controller
              name="lostReason"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>{t("leads.fields.lostReason")}</FieldLabel>
                  <Textarea
                    {...field}
                    id={field.name}
                    placeholder={t("leads.placeholders.lostReason")}
                    aria-invalid={fieldState.invalid}
                    disabled={isSaving}
                    className="min-h-20"
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          ) : null}
        </FieldGroup>
      </FormSection>
      <Separator />
      <FormSection
        title={t("leads.form.notesSection")}
        description={t("leads.form.notesDescription")}
      >
        <Controller
          name="notes"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>{t("leads.fields.notes")}</FieldLabel>
              <Textarea
                {...field}
                id={field.name}
                placeholder={t("leads.placeholders.notes")}
                aria-invalid={fieldState.invalid}
                disabled={isSaving}
                className="min-h-28"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FormSection>
    </Fragment>
  )

  const actions = (
    <Fragment>
      {serverError ? <FieldError>{serverError}</FieldError> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
          {t("common.actions.cancel")}
        </Button>
        <Button type="submit" disabled={submitDisabled}>
          {isSaving && <Spinner />}
          <Icon name="Save" aria-hidden="true" />
          {isEdit ? t("leads.form.saveEdit") : t("leads.form.saveCreate")}
        </Button>
      </div>
    </Fragment>
  )

  if (layout === "panel") {
    return (
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
        className="flex min-h-0 flex-1 flex-col"
      >
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-6 p-4">{fields}</div>
        </ScrollArea>
        <div className="bg-muted/50 flex flex-col gap-3 border-t p-4">{actions}</div>
      </form>
    )
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      {fields}
      <div className="flex flex-col gap-3">{actions}</div>
    </form>
  )
}

export { LeadForm }
