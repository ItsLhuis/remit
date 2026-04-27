"use client"

import { useTransition } from "react"

import { useRouter } from "next/navigation"

import {
  accountDetailsSchema,
  type AccountDetailsValues
} from "@/features/settings/profile/schemas"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"

import { authClient } from "@/lib/authClient"

import { type User } from "@/lib/auth"

import { changeEmailAddress } from "@/features/settings/profile/actions"

import {
  Button,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Icon,
  Input,
  Spinner,
  toast,
  Typography
} from "@/components/ui"

type AccountDetailsSectionProps = {
  user: User
  emailConfigured: boolean
}

const AccountDetailsSection = ({ user, emailConfigured }: AccountDetailsSectionProps) => {
  const [isPending, startTransition] = useTransition()

  const router = useRouter()

  const { refetch: refetchSession } = authClient.useSession()

  const form = useForm<AccountDetailsValues>({
    resolver: zodResolver(accountDetailsSchema),
    mode: "onBlur",
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
        const result = await changeEmailAddress(values.email)

        if ("error" in result) {
          form.setError("email", { message: result.error })
          return
        }

        toast.success("Verification email sent", {
          description: "Check your inbox to confirm the new address"
        })
      }

      form.reset(values)

      await refetchSession()

      router.refresh()

      if (nameChanged && !emailChanged) {
        toast.success("Profile updated")
      }
    })
  }

  return (
    <section className="space-y-4">
      <Typography variant="h4">Account details</Typography>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <Controller
          name="name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Display name</FieldLabel>
              <Input
                {...field}
                id={field.name}
                type="text"
                placeholder="Your name"
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
              <FieldLabel htmlFor={field.name}>Email address</FieldLabel>
              <Input
                {...field}
                id={field.name}
                type="email"
                placeholder="Your email"
                aria-invalid={fieldState.invalid}
                disabled={isPending || !emailConfigured}
              />
              <FieldDescription className="text-muted-foreground text-sm">
                {emailConfigured ? (
                  "A verification email will be sent to the new address."
                ) : (
                  <Typography affects={["small"]}>
                    Email changes require an email provider to be configured in{" "}
                    <span className="inline-flex items-center gap-1 whitespace-nowrap">
                      Settings <Icon name="ArrowRight" /> Email.
                    </span>
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
            Save changes
          </Button>
        </div>
      </form>
    </section>
  )
}

export { AccountDetailsSection }
