"use client"

import { useState } from "react"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Field,
  FieldError,
  FieldLabel,
  FormTextField,
  Icon,
  Spinner,
  Typography
} from "@/components/ui"

import { signContractSchema, type SignContractValues } from "../../schemas"

import { signContract } from "./publicContractClient"

type PublicContractSignFormProps = {
  token: string
  consentText: string
  onSigned: (signedAt: Date) => void
}

const PublicContractSignForm = ({ token, consentText, onSigned }: PublicContractSignFormProps) => {
  const { t } = useTranslation()

  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<SignContractValues>({
    resolver: zodResolver(signContractSchema),
    mode: "onBlur",
    defaultValues: { signerName: "", signerEmail: "", consentAccepted: false }
  })

  const { isDirty, isSubmitting, isValid } = form.formState

  const onSubmit = async (values: SignContractValues) => {
    setServerError(null)

    const result = await signContract(token, values)

    if ("error" in result) {
      setServerError(result.error)

      return
    }

    onSigned(new Date(result.data.signedAt))
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{t("contracts.public.sign.title")}</CardTitle>
        <CardDescription>{t("contracts.public.sign.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" noValidate onSubmit={form.handleSubmit(onSubmit)}>
          <FormTextField
            control={form.control}
            name="signerName"
            autoComplete="name"
            label={t("contracts.public.sign.nameLabel")}
            placeholder={t("contracts.public.sign.namePlaceholder")}
            disabled={isSubmitting}
          />
          <FormTextField
            control={form.control}
            name="signerEmail"
            type="email"
            autoComplete="email"
            label={t("contracts.public.sign.emailLabel")}
            placeholder={t("contracts.public.sign.emailPlaceholder")}
            disabled={isSubmitting}
          />
          <Typography variant="p" affects={["muted", "small", "removePMargin"]}>
            {consentText}
          </Typography>
          <Controller
            name="consentAccepted"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <div className="flex items-center gap-3">
                  <Checkbox
                    id={field.name}
                    name={field.name}
                    ref={field.ref}
                    checked={field.value}
                    aria-invalid={fieldState.invalid}
                    disabled={isSubmitting}
                    onBlur={field.onBlur}
                    // `onBlur()` right after the change is what makes the submit button react to
                    // this box. The form validates on blur, and a checkbox that is clicked and left
                    // focused never blurs — without this the signer ticks the consent and the
                    // button stays disabled until they happen to click elsewhere.
                    onCheckedChange={(checked) => {
                      field.onChange(checked === true)
                      field.onBlur()
                    }}
                  />
                  <FieldLabel htmlFor={field.name}>
                    {t("contracts.public.sign.consentLabel")}
                  </FieldLabel>
                </div>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <Button type="submit" disabled={isSubmitting || !(isDirty && isValid)}>
            {isSubmitting ? <Spinner /> : <Icon name="FileSignature" aria-hidden="true" />}
            {t("contracts.public.sign.submit")}
          </Button>
          {serverError ? <FieldError errors={[{ message: serverError }]} /> : null}
        </form>
      </CardContent>
    </Card>
  )
}

export { PublicContractSignForm }
