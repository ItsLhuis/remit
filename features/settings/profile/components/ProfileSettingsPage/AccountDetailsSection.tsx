"use client"

import { useTransition } from "react"

import { useRouter } from "next/navigation"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import { type User } from "@/lib/auth"
import { authClient } from "@/lib/auth/client"

import {
  Button,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
  Spinner,
  toast,
  Typography
} from "@/components/ui"

import { changeEmailAddress } from "../../mutations"
import { accountDetailsSchema, type AccountDetailsValues } from "../../schemas"

type AccountDetailsSectionProps = {
  user: User
  emailConfigured: boolean
}

const AccountDetailsSection = ({ user, emailConfigured }: AccountDetailsSectionProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [isPending, startTransition] = useTransition()

  const { refetch: refetchSession } = authClient.useSession()

  const form = useForm<AccountDetailsValues>({
    resolver: zodResolver(accountDetailsSchema),
    mode: "onChange",
    defaultValues: {
      name: user.name,
      email: user.email
    }
  })

  const { isDirty, isValid } = form.formState

  const onSubmit = (values: AccountDetailsValues) => {
    if (!isDirty || !isValid) return

    const nameChanged = values.name !== user.name
    const emailChanged = emailConfigured && values.email !== user.email

    if (!nameChanged && !emailChanged) return

    startTransition(async () => {
      if (nameChanged) {
        const { error } = await authClient.updateUser({ name: values.name })

        if (error) {
          form.setError("name", { message: error.message })

          return
        }
      }

      if (emailChanged) {
        const result = await changeEmailAddress({ email: values.email })

        if ("error" in result) {
          form.setError("email", { message: result.error })

          return
        }

        toast.success(t("settings.profile.verificationEmailSent"), {
          description: t("settings.profile.verificationEmailSentDescription")
        })
      }

      form.reset(values)

      await refetchSession()

      router.refresh()

      if (nameChanged && !emailChanged) {
        toast.success(t("settings.profile.profileUpdated"))
      }
    })
  }

  return (
    <section className="space-y-4">
      <Typography variant="h4">{t("settings.profile.accountDetails")}</Typography>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <Controller
          name="name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>{t("settings.profile.displayName")}</FieldLabel>
              <Input
                {...field}
                id={field.name}
                type="text"
                placeholder={t("auth.register.namePlaceholder")}
                aria-invalid={fieldState.invalid}
                disabled={isPending}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="email"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>{t("settings.profile.emailAddress")}</FieldLabel>
              <Input
                {...field}
                id={field.name}
                type="email"
                placeholder={t("auth.register.emailPlaceholder")}
                aria-invalid={fieldState.invalid}
                disabled={isPending || !emailConfigured}
              />
              <FieldDescription className="text-muted-foreground text-sm">
                {emailConfigured ? (
                  t("settings.profile.emailVerificationDescription")
                ) : (
                  <Typography affects={["small"]}>
                    {t("settings.profile.emailProviderRequired")}
                  </Typography>
                )}
              </FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={isPending || !(isDirty && isValid)}>
            {isPending && <Spinner />}
            {t("common.actions.saveChanges")}
          </Button>
        </div>
      </form>
    </section>
  )
}

export { AccountDetailsSection }
