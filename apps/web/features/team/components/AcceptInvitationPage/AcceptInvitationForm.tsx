"use client"

import { useState } from "react"

import { useRouter } from "next/navigation"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, useWatch } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import { authClient, signOut } from "@/lib/auth/client"

import {
  Button,
  Field,
  FieldError,
  FieldLabel,
  Input,
  PasswordInput,
  Spinner,
  Typography
} from "@/components/ui"

import { accountSchema, PasswordRequirements, type AccountValues } from "@/features/auth"

import { acceptTeamInvitation } from "../../mutations"
import { type InvitationPreview } from "../../types"

import { InvitationNotice } from "./InvitationNotice"

type AcceptInvitationFormProps = {
  preview: InvitationPreview
}

const AcceptInvitationForm = ({ preview }: AcceptInvitationFormProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [serverError, setServerError] = useState<string | null>(null)
  const [isAccepting, setIsAccepting] = useState(false)

  const form = useForm<AccountValues>({
    resolver: zodResolver(accountSchema),
    mode: "onChange",
    // The email is never a control: it is the invitation's, read from the database in
    // `getInvitationPreview`, and Better Auth's `acceptInvitation` refuses any session whose email
    // is not the invited one. Rendering it as an input would offer an edit that cannot succeed.
    defaultValues: { name: "", email: preview.email, password: "", confirmPassword: "" }
  })

  const { isSubmitting, isDirty, isValid } = form.formState

  const password =
    useWatch({
      control: form.control,
      name: "password"
    }) ?? ""

  const isSignedInAsInvitee = preview.sessionEmail === preview.email

  // Never a direct push to `/setup`: `proxy.ts` owns where a session belongs, and sending the new
  // member to the root is what routes them through its mandatory-TOTP branch rather than around it.
  const acceptAndContinue = async () => {
    const result = await acceptTeamInvitation({ invitationId: preview.invitationId })

    if ("error" in result) {
      setServerError(result.error)

      return
    }

    router.push("/")
    router.refresh()
  }

  const onSubmit = async (values: AccountValues) => {
    if (!isDirty || !isValid) return

    setServerError(null)

    const { error } = await authClient.signUp.email({
      name: values.name,
      email: preview.email,
      password: values.password
    })

    if (error) {
      setServerError(error.message ?? t("team.accept.signUpFailed"))

      return
    }

    await acceptAndContinue()
  }

  const onAccept = async () => {
    setServerError(null)
    setIsAccepting(true)

    await acceptAndContinue()

    setIsAccepting(false)
  }

  if (preview.sessionEmail && !isSignedInAsInvitee) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <Typography variant="p" affects={["muted", "small", "removePMargin"]}>
          {t("team.accept.wrongAccount", {
            current: preview.sessionEmail,
            invited: preview.email
          })}
        </Typography>
        <Button
          type="button"
          size="lg"
          variant="outline"
          className="w-full"
          onClick={() => void signOut().then(() => router.refresh())}
        >
          {t("team.accept.signOut")}
        </Button>
      </div>
    )
  }

  // Registration is impossible for this address — the unique email would reject it — so the only
  // way forward is the credentials they already have. The invitation survives the round trip: it
  // stays pending, and reopening this link while signed in lands on the accept branch below.
  if (!preview.sessionEmail && preview.hasAccount) {
    return (
      <InvitationNotice
        message={t("team.accept.hasAccountMessage", { email: preview.email })}
        actionHref="/login"
        actionLabel={t("team.accept.goToSignIn")}
      />
    )
  }

  if (isSignedInAsInvitee) {
    return (
      <div className="flex flex-col gap-4">
        <Typography
          variant="p"
          affects={["muted", "small", "removePMargin"]}
          className="text-center"
        >
          {t("team.accept.signedInMessage", { email: preview.email })}
        </Typography>
        <Button
          type="button"
          size="lg"
          className="w-full"
          disabled={isAccepting}
          onClick={onAccept}
        >
          {isAccepting && <Spinner />}
          {t("team.accept.acceptInvitation")}
        </Button>
        {serverError && (
          <FieldError className="text-center" role="alert">
            {serverError}
          </FieldError>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <Field>
        <FieldLabel htmlFor="invitation-email">{t("common.fields.email")}</FieldLabel>
        <Input id="invitation-email" value={preview.email} readOnly disabled />
      </Field>
      <Controller
        name="name"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={field.name}>{t("common.fields.name")}</FieldLabel>
            <Input
              {...field}
              id={field.name}
              placeholder={t("auth.register.namePlaceholder")}
              aria-invalid={fieldState.invalid}
              disabled={isSubmitting}
            />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <Controller
        name="password"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={field.name}>{t("common.fields.password")}</FieldLabel>
            <PasswordInput
              {...field}
              id={field.name}
              placeholder={t("auth.register.passwordPlaceholder")}
              autoComplete="new-password"
              aria-invalid={fieldState.invalid}
              disabled={isSubmitting}
            />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            <PasswordRequirements password={password} />
          </Field>
        )}
      />
      <Controller
        name="confirmPassword"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={field.name}>{t("auth.register.confirmPassword")}</FieldLabel>
            <PasswordInput
              {...field}
              id={field.name}
              placeholder={t("auth.register.confirmPasswordPlaceholder")}
              autoComplete="new-password"
              aria-invalid={fieldState.invalid}
              disabled={isSubmitting}
            />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <Button
        type="submit"
        size="lg"
        className="mt-2 w-full"
        disabled={isSubmitting || !(isDirty && isValid)}
      >
        {isSubmitting && <Spinner />}
        {t("team.accept.createAccount")}
      </Button>
      {serverError && (
        <FieldError className="text-center" role="alert">
          {serverError}
        </FieldError>
      )}
    </form>
  )
}

export { AcceptInvitationForm }
