"use client"

import { useState } from "react"

import { useRouter } from "next/navigation"

import { authClient } from "@/lib/authClient"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import {
  accountSchema,
  businessProfileSchema,
  totpVerifySchema,
  type AccountValues,
  type BusinessProfileValues,
  type TotpVerifyValues
} from "./schemas"

import { QRCodeSVG } from "qrcode.react"

import Image from "next/image"

import {
  Button,
  CountrySelect,
  CurrencySelect,
  Field,
  FieldError,
  FieldLabel,
  Icon,
  Input,
  Spinner,
  Typography
} from "@/components/ui"

type Step = "account" | "totp" | "business" | "done"

const AccountStep = ({ onComplete }: { onComplete: (password: string) => void }) => {
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<AccountValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: { name: "", email: "", password: "" }
  })

  const { isSubmitting } = form.formState

  const onSubmit = async (values: AccountValues) => {
    setServerError(null)

    const { error } = await authClient.signUp.email({
      name: values.name,
      email: values.email,
      password: values.password
    })

    if (error) {
      setServerError(error.message ?? "Failed to create account.")
      return
    }

    onComplete(values.password)
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 flex flex-col items-center text-center">
        <Image src="/logo.png" alt="Remit logo" width={64} height={64} className="mb-4" />
        <Typography variant="h2" className="mb-2">
          Create Your Account
        </Typography>
        <Typography variant="p" affects={["muted", "removePMargin"]}>
          Set up your Remit account to get started.
        </Typography>
      </div>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <Controller
          name="name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Name</FieldLabel>
              <Input
                {...field}
                id={field.name}
                placeholder="Jane Smith"
                aria-invalid={fieldState.invalid}
                disabled={isSubmitting}
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
              <FieldLabel htmlFor={field.name}>Email</FieldLabel>
              <Input
                {...field}
                id={field.name}
                type="email"
                placeholder="jane@example.com"
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
              <FieldLabel htmlFor={field.name}>Password</FieldLabel>
              <Input
                {...field}
                id={field.name}
                type="password"
                placeholder="••••••••"
                aria-invalid={fieldState.invalid}
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
        <Typography variant="span" affects="small" className="text-muted-foreground">
          Step 1 of 4
        </Typography>
      </div>
    </div>
  )
}

const TotpStep = ({ password, onComplete }: { password: string; onComplete: () => void }) => {
  const [totpUri, setTotpUri] = useState<string | null>(null)

  const [secret, setSecret] = useState<string | null>(null)

  const [enableError, setEnableError] = useState<string | null>(null)
  const [isEnabling, setIsEnabling] = useState(false)

  const form = useForm<TotpVerifyValues>({
    resolver: zodResolver(totpVerifySchema),
    defaultValues: { code: "" }
  })

  const { isSubmitting } = form.formState

  const handleEnable = async () => {
    setEnableError(null)
    setIsEnabling(true)

    const { data, error } = await authClient.twoFactor.enable({ password })

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

  const onSubmit = async (values: TotpVerifyValues) => {
    const { error } = await authClient.twoFactor.verifyTotp({ code: values.code })

    if (error) {
      form.setError("code", { message: error.message ?? "Invalid code. Please try again." })
      return
    }

    onComplete()
  }

  if (!totpUri) {
    return (
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Icon name="ShieldCheck" className="mb-4 size-10 text-muted-foreground" />
          <Typography variant="h2" className="mb-2">
            Two-Factor Authentication
          </Typography>
          <Typography variant="p" affects={["muted", "removePMargin"]}>
            Add an extra layer of security to your account with a one-time code from your
            authenticator app.
          </Typography>
        </div>
        <Button size="lg" className="w-full" disabled={isEnabling} onClick={handleEnable}>
          {isEnabling && <Spinner />}
          Set Up Authenticator
        </Button>
        {enableError && (
          <FieldError className="mt-4 text-center" role="alert">
            {enableError}
          </FieldError>
        )}
        <div className="mt-6 text-center">
          <Typography variant="span" affects="small" className="text-muted-foreground">
            Step 2 of 4
          </Typography>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 flex flex-col items-center text-center">
        <Icon name="ShieldCheck" className="mb-4 size-10 text-muted-foreground" />
        <Typography variant="h2" className="mb-2">
          Scan QR Code
        </Typography>
        <Typography variant="p" affects={["muted", "removePMargin"]}>
          Scan this code with your authenticator app, then enter the 6-digit verification code
          below.
        </Typography>
      </div>
      <div className="mb-6 flex justify-center rounded-lg border bg-white p-4">
        <QRCodeSVG value={totpUri} bgColor="white" size={200} />
      </div>
      {secret && (
        <div className="mb-6 rounded-lg border p-3 text-center">
          <Typography variant="span" affects="small" className="text-muted-foreground">
            Manual entry code
          </Typography>
          <Typography variant="p" affects={["bold", "removePMargin"]} className="mt-1 font-mono">
            {secret}
          </Typography>
        </div>
      )}
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <Controller
          name="code"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Verification Code</FieldLabel>
              <Input
                {...field}
                id={field.name}
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                autoComplete="one-time-code"
                aria-invalid={fieldState.invalid}
                disabled={isSubmitting}
                className="text-center tracking-widest"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Spinner />}
          Verify Code
        </Button>
      </form>
      <div className="mt-6 text-center">
        <Typography variant="span" affects="small" className="text-muted-foreground">
          Step 2 of 4
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
          Business Profile
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
              <FieldLabel htmlFor={field.name}>Business Name</FieldLabel>
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
              <FieldLabel htmlFor={field.name}>Business Email</FieldLabel>
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
              <FieldLabel>Default Currency</FieldLabel>
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
        <Typography variant="span" affects="small" className="text-muted-foreground">
          Step 3 of 4
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
        <Icon name="CheckCircle" className="mb-4 size-10 text-muted-foreground" />
        <Typography variant="h2" className="mb-2">
          You&apos;re all set
        </Typography>
        <Typography variant="p" affects={["muted", "removePMargin"]}>
          Remit is ready. Start by adding your first client.
        </Typography>
      </div>
      <Button size="lg" className="w-full" onClick={() => router.push("/dashboard")}>
        Go to Dashboard
      </Button>
      <div className="mt-6 text-center">
        <Typography variant="span" affects="small" className="text-muted-foreground">
          Step 4 of 4
        </Typography>
      </div>
    </div>
  )
}

const SetupForm = () => {
  const [step, setStep] = useState<Step>("account")

  const [accountPassword, setAccountPassword] = useState("")

  return (
    <>
      {step === "account" && (
        <AccountStep
          onComplete={(password) => {
            setAccountPassword(password)
            setStep("totp")
          }}
        />
      )}
      {step === "totp" && (
        <TotpStep
          password={accountPassword}
          onComplete={() => {
            setAccountPassword("")
            setStep("business")
          }}
        />
      )}
      {step === "business" && <BusinessStep onComplete={() => setStep("done")} />}
      {step === "done" && <DoneStep />}
    </>
  )
}

export { SetupForm }
