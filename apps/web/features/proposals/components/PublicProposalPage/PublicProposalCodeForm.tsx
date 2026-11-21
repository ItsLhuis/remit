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
  Icon,
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  Spinner,
  Typography
} from "@/components/ui"

import {
  proposalResponseCodeSchema,
  type ProposalAction,
  type ProposalResponseCodeValues,
  type ProposalResponseIdentityValues,
  type ProposalStatus
} from "../../schemas"
import { PROPOSAL_OTP_LENGTH, PROPOSAL_OTP_TTL_MINUTES } from "../../services"

import { requestProposalCode, verifyProposalCode } from "./publicProposalClient"

const OTP_SLOTS = Array.from({ length: PROPOSAL_OTP_LENGTH }, (_, index) => index)

type PublicProposalCodeFormProps = {
  action: ProposalAction
  token: string
  identity: ProposalResponseIdentityValues
  onVerified: (status: ProposalStatus) => void
  onBack: () => void
}

const PublicProposalCodeForm = ({
  action,
  token,
  identity,
  onVerified,
  onBack
}: PublicProposalCodeFormProps) => {
  const { t } = useTranslation()

  const [serverError, setServerError] = useState<string | null>(null)
  const [isResending, setIsResending] = useState(false)

  const form = useForm<ProposalResponseCodeValues>({
    resolver: zodResolver(proposalResponseCodeSchema),
    mode: "onSubmit",
    defaultValues: { code: "" }
  })

  // No `isValid` gate on the submit button: `mode: "onSubmit"` leaves `isValid` false until the
  // first submit, and an OTP field that is filled but never blurred would otherwise leave the
  // button permanently disabled. A short code is caught by the resolver and shown in `FieldError`.
  const { isSubmitting } = form.formState

  const onSubmit = async (values: ProposalResponseCodeValues) => {
    setServerError(null)

    const result = await verifyProposalCode(token, {
      action,
      email: identity.email,
      code: values.code,
      rejectionReason: identity.rejectionReason
    })

    if ("error" in result) {
      setServerError(result.error)
      form.resetField("code")

      return
    }

    onVerified(result.data.status)
  }

  const handleResend = async () => {
    if (isResending) return

    setIsResending(true)
    setServerError(null)

    try {
      const result = await requestProposalCode(token, { action, email: identity.email })

      if ("error" in result) setServerError(result.error)

      form.resetField("code")
    } finally {
      // In `finally` so an unexpected throw cannot strand the flag true and leave the client
      // staring at a permanently disabled form with no way back.
      setIsResending(false)
    }
  }

  return (
    <form className="flex flex-col gap-4" noValidate onSubmit={form.handleSubmit(onSubmit)}>
      <div className="flex flex-col gap-1">
        <Typography affects={["small", "medium"]}>{t("proposals.public.code.title")}</Typography>
        <Typography variant="p" affects={["muted", "small", "removePMargin"]}>
          {t("proposals.public.code.description", {
            length: PROPOSAL_OTP_LENGTH,
            minutes: PROPOSAL_OTP_TTL_MINUTES
          })}
        </Typography>
      </div>
      <Controller
        name="code"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={field.name}>{t("proposals.public.code.label")}</FieldLabel>
            <InputOTP
              {...field}
              id={field.name}
              maxLength={PROPOSAL_OTP_LENGTH}
              inputMode="numeric"
              autoComplete="one-time-code"
              disabled={isSubmitting || isResending}
            >
              <InputOTPGroup>
                {OTP_SLOTS.map((slot) => (
                  <InputOTPSlot key={slot} index={slot} aria-invalid={fieldState.invalid} />
                ))}
              </InputOTPGroup>
            </InputOTP>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" disabled={isSubmitting} onClick={onBack}>
          <Icon name="ArrowLeft" aria-hidden="true" />
          {t("proposals.public.respond.back")}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isSubmitting || isResending}
          onClick={handleResend}
        >
          {isResending ? <Spinner /> : <Icon name="RotateCcw" aria-hidden="true" />}
          {t("proposals.public.respond.resend")}
        </Button>
        <Button type="submit" disabled={isSubmitting || isResending}>
          {isSubmitting ? <Spinner /> : <Icon name="Check" aria-hidden="true" />}
          {t("proposals.public.code.submit")}
        </Button>
      </div>
      {serverError ? <FieldError errors={[{ message: serverError }]} /> : null}
    </form>
  )
}

export { PublicProposalCodeForm }
