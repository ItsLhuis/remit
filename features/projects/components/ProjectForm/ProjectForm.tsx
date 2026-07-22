"use client"

import { Fragment, useMemo, useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, useWatch } from "react-hook-form"

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

import { createProject, updateProject } from "../../mutations"
import {
  projectFormSchema,
  PROJECT_STATUS_VALUES,
  type ProjectFormInputValues,
  type ProjectFormValues,
  type ProjectStatus
} from "../../schemas"
import { type ProjectClientOption, type ProjectFormData } from "../../types"

import { FormSection } from "./FormSection"

type ProjectFormCallbacks = {
  onSuccess?: (project: { id: string }) => void
  onCancel?: () => void
  layout?: "page" | "panel"
}

type ProjectFormProps = ProjectFormCallbacks &
  (
    | { mode: "create"; clients: ProjectClientOption[]; defaultClientId?: string; project?: never }
    | {
        mode: "edit"
        clients: ProjectClientOption[]
        project: ProjectFormData
        defaultClientId?: never
      }
  )

const ProjectForm = (props: ProjectFormProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [serverError, setServerError] = useState<string | null>(null)
  const [status, setStatus] = useState<ProjectStatus>("active")
  const [isSaving, startSaving] = useTransition()

  const defaultValues = useMemo<ProjectFormInputValues>(() => {
    if (props.mode === "edit") return props.project

    return {
      clientId: props.defaultClientId ?? "",
      name: "",
      budget: "",
      hourlyRate: "",
      startDate: "",
      endDate: "",
      description: ""
    }
  }, [props.mode, props.project, props.defaultClientId])

  const form = useForm<ProjectFormInputValues, unknown, ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    mode: "onChange",
    defaultValues
  })

  const { isDirty, isValid } = form.formState

  const isEdit = props.mode === "edit"

  const layout = props.layout ?? "page"

  const selectedClientId = useWatch({ control: form.control, name: "clientId" })
  const selectedCurrency = props.clients.find((client) => client.id === selectedClientId)?.currency

  const submitDisabled = isSaving || !isValid || (isEdit && !isDirty)

  const onSubmit = () => {
    if (submitDisabled) return

    const values = form.getValues()

    setServerError(null)

    startSaving(async () => {
      const result = isEdit
        ? await updateProject({ id: props.project.id, ...values })
        : await createProject({ ...values, status })

      if ("error" in result) {
        setServerError(result.error)

        return
      }

      toast.success(isEdit ? t("projects.form.updated") : t("projects.form.created"))

      if (props.onSuccess) {
        props.onSuccess(result.data.project)

        return
      }

      router.push(`/projects/${result.data.project.id}`)
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

  const moneyLabel = (key: "budget" | "hourlyRate") =>
    selectedCurrency
      ? `${t(`projects.fields.${key}`)} (${selectedCurrency})`
      : t(`projects.fields.${key}`)

  const fields = (
    <Fragment>
      <FormSection
        title={t("projects.form.detailsSection")}
        description={t("projects.form.detailsDescription")}
      >
        <FieldGroup className="grid gap-4">
          <Controller
            name="clientId"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>{t("projects.fields.client")}</FieldLabel>
                <Select value={field.value} onValueChange={field.onChange} disabled={isSaving}>
                  <SelectTrigger id={field.name} aria-invalid={fieldState.invalid}>
                    <SelectValue placeholder={t("projects.placeholders.client")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {props.clients.map((client) => (
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
          <FormTextField
            control={form.control}
            name="name"
            label={t("projects.fields.name")}
            placeholder={t("projects.placeholders.name")}
            disabled={isSaving}
          />
          {!isEdit ? (
            <Field>
              <FieldLabel htmlFor="project-status">{t("projects.fields.status")}</FieldLabel>
              <Select value={status} onValueChange={(value) => setStatus(value as ProjectStatus)}>
                <SelectTrigger id="project-status" disabled={isSaving}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {PROJECT_STATUS_VALUES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {t(`projects.status.${value}`)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          ) : null}
        </FieldGroup>
      </FormSection>
      <Separator />
      <FormSection
        title={t("projects.form.budgetSection")}
        description={t("projects.form.budgetDescription")}
      >
        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          <FormTextField
            control={form.control}
            name="budget"
            label={moneyLabel("budget")}
            placeholder={t("projects.placeholders.amount")}
            inputMode="decimal"
            disabled={isSaving}
          />
          <FormTextField
            control={form.control}
            name="hourlyRate"
            label={moneyLabel("hourlyRate")}
            placeholder={t("projects.placeholders.amount")}
            inputMode="decimal"
            disabled={isSaving}
          />
          <FormDateField
            control={form.control}
            name="startDate"
            label={t("projects.fields.startDate")}
            disabled={isSaving}
          />
          <FormDateField
            control={form.control}
            name="endDate"
            label={t("projects.fields.endDate")}
            disabled={isSaving}
          />
        </FieldGroup>
      </FormSection>
      <Separator />
      <FormSection
        title={t("projects.form.descriptionSection")}
        description={t("projects.form.descriptionDescription")}
      >
        <Controller
          name="description"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>{t("projects.fields.description")}</FieldLabel>
              <Textarea
                {...field}
                id={field.name}
                placeholder={t("projects.placeholders.description")}
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
          {isEdit ? t("projects.form.saveEdit") : t("projects.form.saveCreate")}
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

export { ProjectForm }
