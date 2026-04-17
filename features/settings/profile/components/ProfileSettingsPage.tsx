"use client"

import { useRef, useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import {
  accountDetailsSchema,
  type AccountDetailsValues
} from "@/features/settings/profile/schemas"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"

import { authClient } from "@/lib/authClient"

import { type User } from "@/lib/auth"

import {
  changeEmailAddress,
  confirmAvatarUpload,
  updateProfileName
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
  Icon,
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
  const [isPending, startTransition] = useTransition()

  const [uploadError, setUploadError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const router = useRouter()

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) return

    setUploadError(null)

    event.target.value = ""

    startTransition(async () => {
      const presignResponse = await fetch("/api/upload/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type })
      })

      if (!presignResponse.ok) {
        const data: unknown = await presignResponse.json()
        const message =
          typeof data === "object" && data !== null && "error" in data
            ? String((data as Record<string, unknown>).error)
            : "Failed to get upload URL."
        setUploadError(message)
        return
      }

      const { uploadUrl, objectKey } = (await presignResponse.json()) as {
        uploadUrl: string
        objectKey: string
      }

      const putResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file
      })

      if (!putResponse.ok) {
        setUploadError("Failed to upload file.")
        return
      }

      const result = await confirmAvatarUpload(objectKey, file.name, file.type, file.size)

      if ("error" in result) {
        setUploadError(result.error)
        return
      }

      await authClient.getSession({ fetchOptions: { cache: "no-store" } })

      router.refresh()
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
  emailConfigured: boolean
}

const AccountDetailsSection = ({ user, emailConfigured }: AccountDetailsSectionProps) => {
  const [isPending, startTransition] = useTransition()

  const [submitError, setSubmitError] = useState<string | null>(null)

  const [emailVerificationSent, setEmailVerificationSent] = useState(false)

  const router = useRouter()

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
    const emailChanged = emailConfigured && values.email !== user.email

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

      await authClient.getSession({ fetchOptions: { cache: "no-store" } })
      router.refresh()
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
                  <Typography>
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
  emailConfigured: boolean
}

const ProfileSettingsPage = ({ user, emailConfigured }: ProfileSettingsPageProps) => {
  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <header className="flex items-center gap-2">
        <SidebarTrigger className="md:hidden" />
        <Typography variant="h2">Profile</Typography>
      </header>
      <div className="space-y-8">
        <AvatarSection user={user} />
        <Separator />
        <AccountDetailsSection user={user} emailConfigured={emailConfigured} />
      </div>
    </div>
  )
}

export { ProfileSettingsPage }
