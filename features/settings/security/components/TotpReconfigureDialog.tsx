"use client"

import { Fragment, useMemo, useState } from "react"

import { useCopyWithFeedback } from "@/hooks/useCopyWithFeedback"

import { authClient } from "@/lib/authClient"

import {
  confirmPasswordSchema,
  totpVerifySchema,
  type ConfirmPasswordValues,
  type TotpVerifyValues
} from "@/features/settings/security/schemas"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"

import { QRCodeSVG } from "qrcode.react"

import {
  Button,
  Checkbox,
  CopyIcon,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Field,
  FieldError,
  FieldLabel,
  Input,
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  Label,
  RecoveryCodes,
  Spinner,
  toast,
  Typography
} from "@/components/ui"

type Step = "confirm" | "scan" | "codes"

type ReconfigureState = {
  totpUri: string
  backupCodes: string[]
  password: string
}

const TotpReconfigureDialog = () => {
  const [open, setOpen] = useState(false)

  const [step, setStep] = useState<Step>("confirm")

  const [state, setState] = useState<Partial<ReconfigureState>>({})

  const reset = () => {
    setStep("confirm")
    setState({})
  }

  const handleOpenChange = (next: boolean) => {
    if (!next && step !== "confirm") return

    if (!next) reset()

    setOpen(next)
  }

  const handleDone = () => {
    setOpen(false)
    reset()
    toast.success("Two-factor authentication reconfigured", {
      description: "Your new TOTP secret and recovery codes are active"
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Reconfigure
        </Button>
      </DialogTrigger>
      <DialogContent
        showCloseButton={step === "confirm"}
        onEscapeKeyDown={step !== "confirm" ? (e) => e.preventDefault() : undefined}
        onInteractOutside={step !== "confirm" ? (e) => e.preventDefault() : undefined}
      >
        {step === "confirm" && (
          <ConfirmStep
            onSuccess={(totpUri, password) => {
              setState({ totpUri, password })
              setStep("scan")
            }}
          />
        )}
        {step === "scan" && state.totpUri && state.password && (
          <ScanStep
            totpUri={state.totpUri}
            password={state.password}
            onSuccess={(backupCodes) => {
              setState((s) => ({ ...s, backupCodes }))
              setStep("codes")
            }}
          />
        )}
        {step === "codes" && state.backupCodes && (
          <CodesStep backupCodes={state.backupCodes} onDone={handleDone} />
        )}
      </DialogContent>
    </Dialog>
  )
}

type ConfirmStepProps = {
  onSuccess: (totpUri: string, password: string) => void
}

const ConfirmStep = ({ onSuccess }: ConfirmStepProps) => {
  const [submitError, setSubmitError] = useState<string | null>(null)

  const form = useForm<ConfirmPasswordValues>({
    resolver: zodResolver(confirmPasswordSchema),
    mode: "onSubmit",
    defaultValues: { password: "" }
  })

  const { isSubmitting, isDirty, isValid } = form.formState

  const onSubmit = async (values: ConfirmPasswordValues) => {
    if (!isDirty || !isValid) return

    setSubmitError(null)

    const { data, error } = await authClient.twoFactor.enable({ password: values.password })

    if (error) {
      setSubmitError(error.message ?? "Failed to start reconfiguration. Check your password.")
      return
    }

    if (!data?.totpURI) {
      setSubmitError("Something went wrong. Please try again.")

      return
    }

    onSuccess(data.totpURI, values.password)
  }

  return (
    <Fragment>
      <DialogHeader>
        <DialogTitle>Reconfigure two-factor authentication</DialogTitle>
        <DialogDescription>
          Your current TOTP secret will be replaced immediately. Do not close this dialog until you
          have scanned the new QR code and saved your recovery codes.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <Controller
          name="password"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Confirm your password</FieldLabel>
              <Input
                {...field}
                id={field.name}
                type="password"
                placeholder="Your password"
                aria-invalid={fieldState.invalid}
                disabled={isSubmitting}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        {submitError && <FieldError>{submitError}</FieldError>}
        <DialogFooter>
          <Button
            type="submit"
            className="w-full sm:w-auto"
            disabled={isSubmitting || !(isDirty && isValid)}
          >
            {isSubmitting && <Spinner />}
            Continue
          </Button>
        </DialogFooter>
      </form>
    </Fragment>
  )
}

type ScanStepProps = {
  totpUri: string
  password: string
  onSuccess: (backupCodes: string[]) => void
}

const ScanStep = ({ totpUri, password, onSuccess }: ScanStepProps) => {
  const [submitError, setSubmitError] = useState<string | null>(null)
  const { copied: isSecretCopied, copy: copySecret } = useCopyWithFeedback()

  const secret = useMemo(() => {
    try {
      return new URL(totpUri).searchParams.get("secret")
    } catch {
      return null
    }
  }, [totpUri])

  const form = useForm<TotpVerifyValues>({
    resolver: zodResolver(totpVerifySchema),
    mode: "onSubmit",
    defaultValues: { code: "" }
  })

  const { isSubmitting, isDirty, isValid } = form.formState

  const onSubmit = async (values: TotpVerifyValues) => {
    if (!isDirty || !isValid) return

    setSubmitError(null)

    const { error: verifyError } = await authClient.twoFactor.verifyTotp({ code: values.code })

    if (verifyError) {
      form.setError("code", {
        message: verifyError.message ?? "Invalid code. Please try again."
      })
      return
    }

    const { data: codesData, error: codesError } = await authClient.twoFactor.generateBackupCodes({
      password
    })

    if (codesError || !codesData?.backupCodes?.length) {
      setSubmitError(
        "TOTP verified, but recovery codes could not be generated. Please try again from settings."
      )
      return
    }

    onSuccess(codesData.backupCodes)
  }

  return (
    <Fragment>
      <DialogHeader>
        <DialogTitle>Scan QR code</DialogTitle>
        <DialogDescription>
          Scan this code with your authenticator app, then enter the 6-digit verification code
          below.
        </DialogDescription>
      </DialogHeader>
      <div className="mx-auto flex w-fit justify-center rounded-lg border bg-white p-4">
        <QRCodeSVG value={totpUri} bgColor="white" size={180} />
      </div>
      {secret && (
        <div className="dark:bg-input/30 rounded-lg border p-3">
          <Typography affects={["small", "muted"]}>Manual entry code</Typography>
          <div className="mt-1 flex items-center gap-3">
            <Typography
              variant="p"
              affects={["bold", "removePMargin"]}
              className="min-w-0 flex-1 font-mono break-all"
              title={secret}
            >
              {secret}
            </Typography>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={() => secret && copySecret(secret)}
            >
              <CopyIcon copied={isSecretCopied} />
            </Button>
          </div>
        </div>
      )}
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
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
        {submitError && <FieldError>{submitError}</FieldError>}
        <DialogFooter>
          <Button
            type="submit"
            className="w-full sm:w-auto"
            disabled={isSubmitting || !(isDirty && isValid)}
          >
            {isSubmitting && <Spinner />}
            Verify code
          </Button>
        </DialogFooter>
      </form>
    </Fragment>
  )
}

type CodesStepProps = {
  backupCodes: string[]
  onDone: () => void
}

const CodesStep = ({ backupCodes, onDone }: CodesStepProps) => {
  const [acknowledged, setAcknowledged] = useState(false)

  return (
    <Fragment>
      <DialogHeader>
        <DialogTitle>Save your new recovery codes</DialogTitle>
        <DialogDescription>
          Your previous recovery codes are now invalid. Store these in a safe place &mdash; they
          won&apos;t be shown again.
        </DialogDescription>
      </DialogHeader>
      <RecoveryCodes codes={backupCodes} />
      <div className="flex items-start gap-3">
        <Checkbox
          id="acknowledge"
          checked={acknowledged}
          onCheckedChange={(checked) => setAcknowledged(checked === true)}
        />
        <Label htmlFor="acknowledge" className="cursor-pointer leading-snug">
          I have saved my recovery codes in a safe place.
        </Label>
      </div>
      <DialogFooter>
        <Button className="w-full sm:w-auto" disabled={!acknowledged} onClick={onDone}>
          Done
        </Button>
      </DialogFooter>
    </Fragment>
  )
}

export { TotpReconfigureDialog }
