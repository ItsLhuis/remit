"use client"

import { Fragment, useMemo, useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import {
  Button,
  CountrySelect,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FormTextField,
  Icon,
  ScrollArea,
  Separator,
  Spinner,
  Textarea,
  toast
} from "@/components/ui"

import { createClient, updateClient } from "../../mutations"
import { type ClientFormInputValues, type ClientFormValues, clientFormSchema } from "../../schemas"
import { type ClientFormData } from "../../types"

import { ClientProfileSection } from "./ClientProfileSection"
import { FormSection } from "./FormSection"

type ClientFormCallbacks = {
  onSuccess?: (client: { id: string }) => void
  onCancel?: () => void
  layout?: "page" | "panel"
}

type ClientFormProps = ClientFormCallbacks &
  (
    | {
        mode: "create"
        defaultCurrency: string
        client?: never
      }
    | {
        mode: "edit"
        client: ClientFormData
        defaultCurrency?: never
      }
  )

const ClientForm = (props: ClientFormProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [serverError, setServerError] = useState<string | null>(null)
  const [isSaving, startSaving] = useTransition()

  const defaultValues = useMemo<ClientFormValues>(() => {
    if (props.mode === "edit") return props.client

    return {
      name: "",
      email: "",
      phone: "",
      currency: props.defaultCurrency,
      taxId: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      postalCode: "",
      country: "",
      notes: "",
      website: "",
      defaultHourlyRate: ""
    }
  }, [props.mode, props.client, props.defaultCurrency])

  const form = useForm<ClientFormInputValues, unknown, ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    mode: "onChange",
    defaultValues
  })

  const { isDirty, isValid } = form.formState

  const isEdit = props.mode === "edit"

  const layout = props.layout ?? "page"

  const submitDisabled = isSaving || !isValid || (isEdit && !isDirty)

  const onSubmit = (values: ClientFormValues) => {
    if (submitDisabled) return

    setServerError(null)

    startSaving(async () => {
      const result =
        props.mode === "edit"
          ? await updateClient({ id: props.client.id, ...values })
          : await createClient(values)

      if ("error" in result) {
        setServerError(result.error)

        return
      }

      toast.success(isEdit ? t("clients.form.updated") : t("clients.form.created"))

      if (props.onSuccess) {
        props.onSuccess(result.data.client)

        return
      }

      router.push(`/clients/${result.data.client.id}`)
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

  const fields = (
    <Fragment>
      <ClientProfileSection control={form.control} disabled={isSaving} />
      <Separator />
      <FormSection
        title={t("clients.form.addressSection")}
        description={t("clients.form.addressDescription")}
      >
        <FieldGroup className="grid gap-4">
          <FormTextField
            control={form.control}
            name="addressLine1"
            label={t("clients.fields.addressLine1")}
            placeholder={t("clients.placeholders.addressLine1")}
            autoComplete="address-line1"
            disabled={isSaving}
          />
          <FormTextField
            control={form.control}
            name="addressLine2"
            label={t("clients.fields.addressLine2")}
            placeholder={t("clients.placeholders.addressLine2")}
            autoComplete="address-line2"
            disabled={isSaving}
          />
          <FormTextField
            control={form.control}
            name="city"
            label={t("clients.fields.city")}
            placeholder={t("clients.placeholders.city")}
            autoComplete="address-level2"
            disabled={isSaving}
          />
          <FormTextField
            control={form.control}
            name="state"
            label={t("clients.fields.state")}
            placeholder={t("clients.placeholders.state")}
            autoComplete="address-level1"
            disabled={isSaving}
          />
          <FormTextField
            control={form.control}
            name="postalCode"
            label={t("clients.fields.postalCode")}
            placeholder={t("clients.placeholders.postalCode")}
            autoComplete="postal-code"
            disabled={isSaving}
          />
          <Controller
            name="country"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>{t("clients.fields.country")}</FieldLabel>
                <CountrySelect
                  id={field.name}
                  ref={field.ref}
                  value={field.value}
                  onChangeAction={(country) => field.onChange(country?.alpha2 ?? "")}
                  valid={!fieldState.invalid}
                  disabled={isSaving}
                  clearable
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
        </FieldGroup>
      </FormSection>
      <Separator />
      <FormSection
        title={t("clients.form.notesSection")}
        description={t("clients.form.notesDescription")}
      >
        <Controller
          name="notes"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>{t("clients.fields.notes")}</FieldLabel>
              <Textarea
                {...field}
                id={field.name}
                placeholder={t("clients.placeholders.notes")}
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
          {isEdit ? t("clients.form.saveEdit") : t("clients.form.saveCreate")}
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

export { ClientForm }
