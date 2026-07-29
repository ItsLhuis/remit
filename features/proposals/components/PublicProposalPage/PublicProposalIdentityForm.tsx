"use client"

import { useState } from "react"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import {
  Button,
  Field,
  FieldError,
  FieldLabel,
  FormTextField,
  Icon,
  Spinner,
  Textarea,
  Typography
} from "@/components/ui"

import {
  proposalResponseIdentitySchema,
  type ProposalAction,
  type ProposalResponseIdentityValues
} from "../../schemas"

import { requestProposalCode } from "./publicProposalClient"

type PublicProposalIdentityFormProps = {
  action: ProposalAction
  token: string
  onSent: (values: ProposalResponseIdentityValues) => void
  onBack: () => void
}

const PublicProposalIdentityForm = ({
  action,
  token,
  onSent,
  onBack
}: PublicProposalIdentityFormProps) => {
  const { t } = useTranslation()

  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<ProposalResponseIdentityValues>({
    resolver: zodResolver(proposalResponseIdentitySchema),
    mode: "onBlur",
    defaultValues: { action, email: "", rejectionReason: "" }
  })

  const { isDirty, isSubmitting, isValid } = form.formState

  const isReject = action === "reject"

  const onSubmit = async (values: ProposalResponseIdentityValues) => {
    setServerError(null)

    const result = await requestProposalCode(token, { action, email: values.email })

    if ("error" in result) {
      setServerError(result.error)

      return
    }

    onSent(values)
  }

  return (
    <form className="flex flex-col gap-4" noValidate onSubmit={form.handleSubmit(onSubmit)}>
      <div className="flex flex-col gap-1">
        <Typography affects={["small", "medium"]}>
          {isReject
            ? t("proposals.public.identity.rejectTitle")
            : t("proposals.public.identity.acceptTitle")}
        </Typography>
        <Typography variant="p" affects={["muted", "small", "removePMargin"]}>
          {isReject
            ? t("proposals.public.identity.rejectDescription")
            : t("proposals.public.identity.acceptDescription")}
        </Typography>
      </div>
      {isReject ? (
        <Controller
          name="rejectionReason"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>
                {t("proposals.public.identity.reasonLabel")}
              </FieldLabel>
              <Textarea
                {...field}
                id={field.name}
                rows={3}
                placeholder={t("proposals.public.identity.reasonPlaceholder")}
                aria-invalid={fieldState.invalid}
                disabled={isSubmitting}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      ) : null}
      <FormTextField
        control={form.control}
        name="email"
        type="email"
        autoComplete="email"
        label={t("proposals.public.identity.emailLabel")}
        placeholder={t("proposals.public.identity.emailPlaceholder")}
        disabled={isSubmitting}
      />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" disabled={isSubmitting} onClick={onBack}>
          <Icon name="ArrowLeft" aria-hidden="true" />
          {t("proposals.public.respond.back")}
        </Button>
        <Button type="submit" disabled={isSubmitting || !(isDirty && isValid)}>
          {isSubmitting ? <Spinner /> : <Icon name="Mail" aria-hidden="true" />}
          {t("proposals.public.identity.submit")}
        </Button>
      </div>
      {serverError ? <FieldError errors={[{ message: serverError }]} /> : null}
    </form>
  )
}

export { PublicProposalIdentityForm }
