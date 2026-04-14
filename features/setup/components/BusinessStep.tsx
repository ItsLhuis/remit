"use client"

import { useState } from "react"

import Image from "next/image"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { businessProfileSchema, type BusinessProfileValues } from "@/features/setup/schemas"

import {
  Button,
  CountrySelect,
  CurrencySelect,
  Field,
  FieldError,
  FieldLabel,
  Input,
  Spinner,
  Typography
} from "@/components/ui"

type BusinessStepProps = {
  onComplete: () => void
}

const BusinessStep = ({ onComplete }: BusinessStepProps) => {
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<BusinessProfileValues>({
    resolver: zodResolver(businessProfileSchema),
    mode: "onBlur",
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
                placeholder="Your business name"
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
                placeholder="Your business email"
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
                placeholder="Your tax ID"
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
              <FieldLabel htmlFor={field.name}>Country</FieldLabel>
              <CountrySelect
                ref={field.ref}
                id={field.name}
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
              <FieldLabel htmlFor={field.name}>Default currency</FieldLabel>
              <CurrencySelect
                ref={field.ref}
                id={field.name}
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
          Step 1 of 4
        </Typography>
      </div>
    </div>
  )
}

export { BusinessStep }
