"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { authClient } from "@/lib/authClient"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { totpVerifySchema, type TotpVerifyValues } from "./schemas"

import { QRCodeSVG } from "qrcode.react"

import Image from "next/image"

import {
  Button,
  Fade,
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

type TotpVerifyStepProps = {
  totpUri: string
  onComplete: () => void
}

const TotpVerifyStep = ({ totpUri, onComplete }: TotpVerifyStepProps) => {
  const [isSecretCopied, setIsSecretCopied] = useState(false)
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  const { isSubmitting } = form.formState

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
    }
  }, [])

  const handleCopySecret = async () => {
    if (!secret) return

    try {
      await navigator.clipboard.writeText(secret)
      setIsSecretCopied(true)
      copyTimeoutRef.current = setTimeout(() => setIsSecretCopied(false), 2000)
    } catch {
      // clipboard write failed — the secret is visible on screen for manual copy
    }
  }

  const onSubmit = async (values: TotpVerifyValues) => {
    const { error } = await authClient.twoFactor.verifyTotp({ code: values.code })

    if (error) {
      form.setError("code", { message: error.message ?? "Invalid code. Please try again." })
      return
    }

    onComplete()
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
      <div className="mx-auto mb-6 flex w-fit justify-center rounded-lg border bg-white p-4">
        <QRCodeSVG value={totpUri} bgColor="white" size={200} />
      </div>
      {secret && (
        <div className="dark:bg-input/30 mb-6 rounded-lg border p-3">
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

export { TotpVerifyStep }
