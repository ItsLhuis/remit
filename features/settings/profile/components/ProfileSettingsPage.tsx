"use client"

import { useRef, useTransition } from "react"

import { useRouter } from "next/navigation"

import {
  accountDetailsSchema,
  type AccountDetailsValues
} from "@/features/settings/profile/schemas"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"

import { authClient } from "@/lib/authClient"

import { resolveStorageUrl } from "@/lib/storage"
import { getInitials } from "@/lib/utils"

import { type User } from "@/lib/auth"

import { changeEmailAddress, confirmAvatarUpload } from "@/features/settings/profile/actions"

import {
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
  toast,
  Typography
} from "@/components/ui"

type AvatarSectionProps = {
  user: User
}

const AvatarSection = ({ user }: AvatarSectionProps) => {
  const [isPending, startTransition] = useTransition()

  const fileInputRef = useRef<HTMLInputElement>(null)

  const router = useRouter()

  const { refetch: refetchSession } = authClient.useSession()

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) return

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

        toast.error(message)

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
        toast.error("Failed to upload file")

        return
      }

      const result = await confirmAvatarUpload(objectKey, file.name, file.type, file.size)

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      const { error: updateError } = await authClient.updateUser({ image: result.storageKey })

      if (updateError) {
        toast.error(updateError.message)

        return
      }

      await refetchSession()

      router.refresh()

      toast.success("Avatar updated")
    })
  }

  return (
    <section className="space-y-4">
      <Typography variant="h4">Avatar</Typography>
      <div className="flex items-center gap-4">
        <Avatar className="size-20 text-base">
          {user.image && <AvatarImage src={resolveStorageUrl(user.image) ?? ""} alt={user.name} />}
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
          <Typography affects={["muted", "small"]}>JPG, PNG, WebP or GIF. Max 5MB.</Typography>
        </div>
      </div>
    </section>
  )
}

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

const LogoutSection = () => {
  const router = useRouter()

  const [isPending, startTransition] = useTransition()

  const handleLogout = () => {
    startTransition(async () => {
      await authClient.signOut()

      router.push("/login")
    })
  }

  return (
    <section className="space-y-4">
      <Typography variant="h4">Session</Typography>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Typography variant="p" affects={["medium", "removePMargin"]}>
            Sign out
          </Typography>
          <Typography variant="p" affects={["muted", "removePMargin", "small"]}>
            Sign out of your account on this device.
          </Typography>
        </div>
        <Button variant="outline" disabled={isPending} onClick={handleLogout}>
          {isPending && <Spinner />}
          Sign out
        </Button>
      </div>
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
        <Separator />
        <LogoutSection />
      </div>
    </div>
  )
}

export { ProfileSettingsPage }
