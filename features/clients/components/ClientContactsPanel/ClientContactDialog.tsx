"use client"

import { useState, useTransition } from "react"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FormTextField,
  PhoneInput,
  Spinner,
  Switch
} from "@/components/ui"

import { createClientContact, updateClientContact } from "../../mutations"
import { clientContactFormSchema, type ClientContactFormValues } from "../../schemas"
import { type ClientContact } from "../../types"

type ClientContactDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (message: string) => void
} & (
  | { mode: "create"; clientId: string; contact?: never }
  | { mode: "edit"; contact: ClientContact; clientId?: never }
)

const ClientContactDialog = (props: ClientContactDialogProps) => {
  const { t } = useTranslation()

  const [serverError, setServerError] = useState<string | null>(null)
  const [isSaving, startSaving] = useTransition()

  const form = useForm<ClientContactFormValues>({
    resolver: zodResolver(clientContactFormSchema),
    mode: "onChange",
    defaultValues:
      props.mode === "edit"
        ? {
            name: props.contact.name,
            email: props.contact.email,
            phone: props.contact.phone,
            role: props.contact.role,
            isPrimary: props.contact.isPrimary
          }
        : { name: "", email: "", phone: "", role: "", isPrimary: false }
  })

  const { isDirty, isValid } = form.formState

  const isEdit = props.mode === "edit"

  const submitDisabled = isSaving || !isValid || (isEdit && !isDirty)

  const onSubmit = (values: ClientContactFormValues) => {
    if (submitDisabled) return

    setServerError(null)

    startSaving(async () => {
      const result =
        props.mode === "edit"
          ? await updateClientContact({ id: props.contact.id, ...values })
          : await createClientContact({ clientId: props.clientId, ...values })

      if ("error" in result) {
        setServerError(result.error)

        return
      }

      props.onSuccess(isEdit ? t("clients.contacts.updated") : t("clients.contacts.created"))
      props.onOpenChange(false)
    })
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("clients.contacts.editTitle") : t("clients.contacts.createTitle")}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? t("clients.contacts.editDescription")
              : t("clients.contacts.createDescription")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
          <FieldGroup className="grid gap-4">
            <FormTextField
              control={form.control}
              name="name"
              label={t("clients.fields.name")}
              placeholder={t("clients.contacts.namePlaceholder")}
              autoComplete="name"
              disabled={isSaving}
            />
            <FormTextField
              control={form.control}
              name="email"
              label={t("clients.fields.email")}
              placeholder={t("clients.placeholders.email")}
              type="email"
              autoComplete="email"
              disabled={isSaving}
            />
            <Controller
              name="phone"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>{t("clients.fields.phone")}</FieldLabel>
                  <PhoneInput
                    id={field.name}
                    name={field.name}
                    ref={field.ref}
                    value={field.value}
                    onBlur={field.onBlur}
                    onValueChangeAction={field.onChange}
                    valid={!fieldState.invalid}
                    disabled={isSaving}
                    placeholder={t("clients.placeholders.phone")}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <FormTextField
              control={form.control}
              name="role"
              label={t("clients.contacts.role")}
              placeholder={t("clients.contacts.rolePlaceholder")}
              disabled={isSaving}
            />
            <Controller
              name="isPrimary"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field orientation="horizontal" data-invalid={fieldState.invalid}>
                  <Switch
                    id={field.name}
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isSaving}
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldLabel htmlFor={field.name}>
                    {t("clients.contacts.primaryToggle")}
                  </FieldLabel>
                </Field>
              )}
            />
          </FieldGroup>
          <DialogFooter className="flex-col gap-3 sm:flex-col">
            {serverError ? <FieldError>{serverError}</FieldError> : null}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={isSaving}
                onClick={() => props.onOpenChange(false)}
              >
                {t("common.actions.cancel")}
              </Button>
              <Button type="submit" disabled={submitDisabled}>
                {isSaving && <Spinner />}
                {t("clients.contacts.save")}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export { ClientContactDialog }
