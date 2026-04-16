"use client"

import { useRef, useState, useTransition } from "react"

import {
  accountDetailsSchema,
  type AccountDetailsValues
} from "@/features/settings/profile/schemas"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"

import { type User } from "@/lib/auth"

import {
  changeEmailAddress,
  updateProfileName,
  uploadAvatar
} from "@/features/settings/profile/actions"

import {
  Alert,
  AlertDescription,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
  Separator,
  SidebarTrigger,
  Spinner,
  Typography
} from "@/components/ui"

const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/)

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  }

  return name.slice(0, 2).toUpperCase()
}

type AvatarSectionProps = {
  user: User
}

const AvatarSection = ({ user }: AvatarSectionProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isPending, startTransition] = useTransition()

  const [uploadError, setUploadError] = useState<string | null>(null)

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) return

    setUploadError(null)

    const formData = new FormData()
    formData.append("file", file)

    event.target.value = ""

    startTransition(async () => {
      const result = await uploadAvatar(formData)

      if ("error" in result) {
        setUploadError(result.error)
      }
    })
  }

  return (
    <section className="space-y-4">
      <Typography variant="h4">Avatar</Typography>
      <div className="flex items-center gap-4">
        <Avatar className="size-20 text-base">
          {user.image && <AvatarImage src={user.image} alt={user.name} />}
          <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            {isPending && <Spinner />}
            Upload photo
          </Button>
          <Typography affects="muted" className="text-xs">
            JPG, PNG, WebP or GIF. Max 5MB.
          </Typography>
        </div>
      </div>
      {uploadError && <FieldError>{uploadError}</FieldError>}
    </section>
  )
}

type AccountDetailsSectionProps = {
  user: User
}

const AccountDetailsSection = ({ user }: AccountDetailsSectionProps) => {
  const [isPending, startTransition] = useTransition()

  const [submitError, setSubmitError] = useState<string | null>(null)

  const [emailVerificationSent, setEmailVerificationSent] = useState(false)

  const form = useForm<AccountDetailsValues>({
    resolver: zodResolver(accountDetailsSchema),
    mode: "onBlur",
    defaultValues: {
      name: user.name,
      email: user.email
    }
  })

  const onSubmit = (values: AccountDetailsValues) => {
    setSubmitError(null)
    setEmailVerificationSent(false)

    const nameChanged = values.name !== user.name
    const emailChanged = values.email !== user.email

    if (!nameChanged && !emailChanged) return

    startTransition(async () => {
      if (nameChanged) {
        const result = await updateProfileName(values.name)

        if ("error" in result) {
          form.setError("name", { message: result.error })
          return
        }
      }

      if (emailChanged) {
        const result = await changeEmailAddress(values.email)

        if ("error" in result) {
          form.setError("email", { message: result.error })
          return
        }

        setEmailVerificationSent(true)
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
                disabled={isPending}
              />
              <FieldDescription className="text-muted-foreground text-sm">
                A verification email will be sent to the new address.
              </FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        {emailVerificationSent && (
          <Alert>
            <AlertDescription>
              Check your inbox — a verification email has been sent to the new address.
            </AlertDescription>
          </Alert>
        )}
        {submitError && <FieldError>{submitError}</FieldError>}
        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending && <Spinner />}
            Save changes
          </Button>
        </div>
      </form>
    </section>
  )
}

type ProfileSettingsPageProps = {
  user: User
}

const ProfileSettingsPage = ({ user }: ProfileSettingsPageProps) => {
  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <header className="flex items-center gap-2">
        <SidebarTrigger className="md:hidden" />
        <Typography variant="h2">Profile</Typography>
      </header>
      <div className="space-y-8">
        <AvatarSection user={user} />
        <Separator />
        <AccountDetailsSection user={user} />
      </div>
    </div>
  )
}

export { ProfileSettingsPage }
