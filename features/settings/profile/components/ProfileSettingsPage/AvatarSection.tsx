"use client"

import { type ChangeEvent, useRef, useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import { useTranslation } from "@/lib/i18n"

import { type User } from "@/lib/auth"
import { useSession } from "@/lib/auth/client"
import { resolveStorageUrl } from "@/lib/storage"
import { getInitials } from "@/lib/utils"

import { confirmAvatarUpload, removeAvatar } from "../../mutations"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Spinner,
  toast,
  Typography
} from "@/components/ui"

type AvatarSectionProps = {
  user: User
}

const AvatarSection = ({ user }: AvatarSectionProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const { refetch } = useSession()

  const [avatarStorageKey, setAvatarStorageKey] = useState<string | null>(user.image ?? null)
  const [isPending, startTransition] = useTransition()

  const fileInputRef = useRef<HTMLInputElement>(null)

  const avatarUrl = resolveStorageUrl(avatarStorageKey)

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) return

    event.target.value = ""

    startTransition(async () => {
      const presignResponse = await fetch("/api/upload/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type, sizeBytes: file.size })
      })

      if (!presignResponse.ok) {
        const data: unknown = await presignResponse.json()
        const message =
          typeof data === "object" && data !== null && "error" in data
            ? String((data as Record<string, unknown>).error)
            : t("settings.profile.uploadUrlFailed")

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
        toast.error(t("settings.profile.uploadFailed"))

        return
      }

      const result = await confirmAvatarUpload({
        objectKey,
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size
      })

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      setAvatarStorageKey(result.data.storageKey)

      await refetch({ query: { disableCookieCache: true } })

      router.refresh()

      toast.success(t("settings.profile.avatarUpdated"))
    })
  }

  const handleRemoveAvatar = () => {
    startTransition(async () => {
      const result = await removeAvatar()

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      setAvatarStorageKey(null)

      await refetch({ query: { disableCookieCache: true } })

      router.refresh()

      toast.success(t("settings.profile.avatarRemoved"))
    })
  }

  const hasAvatar = Boolean(avatarStorageKey)

  return (
    <section className="space-y-4">
      <Typography variant="h4">{t("settings.profile.avatar")}</Typography>
      <div className="flex items-center gap-4">
        <Avatar className="size-20">
          <AvatarImage src={avatarUrl} alt={user.name} />
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
            {t("settings.profile.uploadPhoto")}
          </Button>
          {hasAvatar ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={isPending}
              onClick={handleRemoveAvatar}
            >
              {isPending && <Spinner />}
              {t("settings.profile.removePhoto")}
            </Button>
          ) : null}
          <Typography affects={["muted", "tiny"]}>{t("settings.profile.avatarHelp")}</Typography>
        </div>
      </div>
    </section>
  )
}

export { AvatarSection }
