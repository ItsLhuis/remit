"use client"

import { useState } from "react"

import { useRouter } from "next/navigation"

import { authClient } from "@/lib/authClient"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import {
  businessProfileSchema,
  totpEnableSchema,
  totpVerifySchema,
  type BusinessProfileValues,
  type TotpEnableValues,
  type TotpVerifyValues
} from "./schemas"

import { QRCodeSVG } from "qrcode.react"

import Image from "next/image"

import {
  Button,
  CountrySelect,
  CurrencySelect,
  Fade,
  Field,
  FieldError,
  FieldLabel,
  Icon,
  Input,
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  Spinner,
  Typography
} from "@/components/ui"

type Step = "business" | "totp" | "done"

const TotpStep = ({ onComplete }: { onComplete: () => void }) => {
  const [totpUri, setTotpUri] = useState<string | null>(null)

  const [secret, setSecret] = useState<string | null>(null)
  const [isSecretCopied, setIsSecretCopied] = useState(false)

  const [enableError, setEnableError] = useState<string | null>(null)
  const [isEnabling, setIsEnabling] = useState(false)

  const enableForm = useForm<TotpEnableValues>({
    resolver: zodResolver(totpEnableSchema),
    defaultValues: { password: "" }
  })

  const form = useForm<TotpVerifyValues>({
    resolver: zodResolver(totpVerifySchema),
    defaultValues: { code: "" }
  })

  const { isSubmitting } = form.formState

  const onEnableSubmit = async (values: TotpEnableValues) => {
    setEnableError(null)
    setIsEnabling(true)

    const { data, error } = await authClient.twoFactor.enable({ password: values.password })

    if (error) {
      setEnableError(error.message ?? "Failed to enable two-factor authentication.")
      setIsEnabling(false)

      return
    }

    if (data?.totpURI) {
      setTotpUri(data.totpURI)

      const uriParams = new URL(data.totpURI)

      setSecret(uriParams.searchParams.get("secret"))
    }

    setIsEnabling(false)
  }

  const onVerifySubmit = async (values: TotpVerifyValues) => {
    const { error } = await authClient.twoFactor.verifyTotp({ code: values.code })

    if (error) {
      form.setError("code", { message: error.message ?? "Invalid code. Please try again." })

      return
    }

    onComplete()
  }

  const handleCopySecret = async () => {
    if (!secret) return

    try {
      await navigator.clipboard.writeText(secret)

      setIsSecretCopied(true)

      setTimeout(() => setIsSecretCopied(false), 2000)
    } catch {
      setEnableError("Couldn't copy the manual code. Please copy it manually.")
    }
  }

  if (!totpUri) {
    return (
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Image src="/logo.png" alt="Remit logo" width={64} height={64} className="mb-4" />
          <Typography variant="h2" className="mb-2">
            Two-factor authentication
          </Typography>
          <Typography variant="p" affects={["muted", "removePMargin"]}>
            Add an extra layer of security to your account with a one-time code from your
            authenticator app.
          </Typography>
        </div>
        <form
          onSubmit={enableForm.handleSubmit(onEnableSubmit)}
          noValidate
          className="flex flex-col gap-4"
        >
          <Controller
            name="password"
            control={enableForm.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="totp-password">Password</FieldLabel>
                <Input
                  {...field}
                  id="totp-password"
                  type="password"
                  placeholder="••••••••"
                  aria-invalid={fieldState.invalid}
                  disabled={isEnabling}
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <Button type="submit" size="lg" className="w-full" disabled={isEnabling}>
            {isEnabling && <Spinner />}
            Set up authenticator
          </Button>
        </form>
        {enableError && (
          <FieldError className="mt-4 text-center" role="alert">
            {enableError}
          </FieldError>
        )}
        <div className="mt-6 text-center">
          <Typography affects="small" className="text-muted-foreground">
            Step 2 of 2
          </Typography>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 flex flex-col items-center text-center">
        <Image src="/logo.png" alt="Remit logo" width={64} height={64} className="mb-4" />
        <Typography variant="h2" className="mb-2">
          Scan QR code
        </Typography>
        <Typography variant="p" affects={["muted", "removePMargin"]}>
          Scan this code with your authenticator app, then enter the 6-digit verification code
          below.
        </Typography>
      </div>
      <div className="mb-6 flex mx-auto justify-center rounded-lg border w-fit bg-white p-4">
        <QRCodeSVG value={totpUri} bgColor="white" size={200} />
      </div>
      {secret && (
        <div className="mb-6 rounded-lg border dark:bg-input/30 p-3">
          <Typography affects="small" className="text-muted-foreground">
            Manual entry code
          </Typography>
          <div className="mt-1 flex items-center gap-2">
            <Typography
              variant="p"
              affects={["bold", "removePMargin"]}
              className="min-w-0 flex-1 truncate font-mono"
              title={secret}
            >
              {secret}
            </Typography>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={handleCopySecret}
            >
              <span className="relative inline-flex size-4 items-center justify-center">
                <Fade
                  as="span"
                  show={!isSecretCopied}
                  initial={false}
                  unmountOnExit={false}
                  className="absolute"
                >
                  <Icon name="Copy" />
                </Fade>
                <Fade
                  as="span"
                  show={isSecretCopied}
                  initial={false}
                  unmountOnExit={false}
                  className="absolute"
                >
                  <Icon name="Check" />
                </Fade>
              </span>
            </Button>
          </div>
        </div>
      )}
      <form onSubmit={form.handleSubmit(onVerifySubmit)} noValidate className="flex flex-col gap-4">
        <Controller
          name="code"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Verification code</FieldLabel>
              <InputOTP
                {...field}
                id={field.name}
                maxLength={6}
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="\d*"
                disabled={isSubmitting}
                aria-invalid={fieldState.invalid}
              >
                <InputOTPGroup className="w-full">
                  <InputOTPSlot index={0} className="w-full" />
                  <InputOTPSlot index={1} className="w-full" />
                  <InputOTPSlot index={2} className="w-full" />
                  <InputOTPSlot index={3} className="w-full" />
                  <InputOTPSlot index={4} className="w-full" />
                  <InputOTPSlot index={5} className="w-full" />
                </InputOTPGroup>
              </InputOTP>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Spinner />}
          Verify code
        </Button>
      </form>
      <div className="mt-6 text-center">
        <Typography affects="small" className="text-muted-foreground">
          Step 2 of 2
        </Typography>
      </div>
    </div>
  )
}

const BusinessStep = ({ onComplete }: { onComplete: () => void }) => {
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<BusinessProfileValues>({
    resolver: zodResolver(businessProfileSchema),
    defaultValues: {
      businessName: "",
      businessEmail: "",
      businessTaxId: "",
      businessCountry: "",
      defaultCurrency: ""
    }
  })

  const { isSubmitting } = form.formState

  const onSubmit = async (values: BusinessProfileValues) => {
    setServerError(null)

    const res = await fetch("/api/setup/business", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values)
    })

    if (!res.ok) {
      const data = await res.json()

      setServerError(data.error ?? "Something went wrong.")

      return
    }

    onComplete()
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 flex flex-col items-center text-center">
        <Image src="/logo.png" alt="Remit logo" width={64} height={64} className="mb-4" />
        <Typography variant="h2" className="mb-2">
          Business profile
        </Typography>
        <Typography variant="p" affects={["muted", "removePMargin"]}>
          Tell us about your business to personalize your experience.
        </Typography>
      </div>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <Controller
          name="businessName"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Business name</FieldLabel>
              <Input
                {...field}
                id={field.name}
                placeholder="Acme Inc."
                aria-invalid={fieldState.invalid}
                disabled={isSubmitting}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="businessEmail"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Business email</FieldLabel>
              <Input
                {...field}
                id={field.name}
                type="email"
                placeholder="billing@acme.com"
                aria-invalid={fieldState.invalid}
                disabled={isSubmitting}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="businessTaxId"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Tax ID</FieldLabel>
              <Input
                {...field}
                id={field.name}
                placeholder="e.g. DE123456789"
                aria-invalid={fieldState.invalid}
                disabled={isSubmitting}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="businessCountry"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>Country</FieldLabel>
              <CountrySelect
                ref={field.ref}
                value={field.value}
                onChangeAction={(country) => field.onChange(country.alpha2)}
                valid={!fieldState.invalid}
                disabled={isSubmitting}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="defaultCurrency"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>Default currency</FieldLabel>
              <CurrencySelect
                ref={field.ref}
                value={field.value}
                onValueChangeAction={field.onChange}
                currencies="all"
                variant="default"
                valid={!fieldState.invalid}
                disabled={isSubmitting}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Button type="submit" size="lg" className="mt-2 w-full" disabled={isSubmitting}>
          {isSubmitting && <Spinner />}
          Continue
        </Button>
        {serverError && (
          <FieldError className="text-center" role="alert">
            {serverError}
          </FieldError>
        )}
      </form>
      <div className="mt-6 text-center">
        <Typography affects="small" className="text-muted-foreground">
          Step 1 of 2
        </Typography>
      </div>
    </div>
  )
}

const DoneStep = () => {
  const router = useRouter()

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 flex flex-col items-center text-center">
        <Image src="/logo.png" alt="Remit logo" width={64} height={64} className="mb-4" />
        <Typography variant="h2" className="mb-2">
          You&apos;re all set
        </Typography>
        <Typography variant="p" affects={["muted", "removePMargin"]}>
          Remit is ready. Start by adding your first client.
        </Typography>
      </div>
      <Button size="lg" className="w-full" onClick={() => router.push("/dashboard")}>
        Go to dashboard
      </Button>
    </div>
  )
}

type SetupFormProps = {
  initialStep: Step
}

const SetupForm = ({ initialStep }: SetupFormProps) => {
  const [step, setStep] = useState<Step>(initialStep)

  return (
    <>
      {step === "business" && <BusinessStep onComplete={() => setStep("totp")} />}
      {step === "totp" && <TotpStep onComplete={() => setStep("done")} />}
      {step === "done" && <DoneStep />}
    </>
  )
}

export { SetupForm }
