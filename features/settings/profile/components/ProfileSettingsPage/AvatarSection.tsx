"use client"

import { useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import { useTranslation } from "@/lib/i18n"

import { type User } from "@/lib/auth"
import { useSession } from "@/lib/auth/client"

import { resolveStorageUrl } from "@/lib/storage"

import {
  Button,
  EntityAvatar,
  FileDropzone,
  FileUploadProgressList,
  Spinner,
  toast,
  Typography
} from "@/components/ui"

import { IMAGE_UPLOAD_MAX_BYTES, IMAGE_UPLOAD_MIME_TYPES, useFileUpload } from "@/hooks"

import { confirmAvatarUpload, removeAvatar } from "../../mutations"

type AvatarSectionProps = {
  user: User
  locale: string
}

const AvatarSection = ({ user, locale }: AvatarSectionProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const { refetch } = useSession()

  const [avatarStorageKey, setAvatarStorageKey] = useState<string | null>(user.image ?? null)
  const [isRemoving, startRemoving] = useTransition()

  const { items, isUploading, upload, dismiss } = useFileUpload({
    type: "avatar",
    maxBytes: IMAGE_UPLOAD_MAX_BYTES,
    mimeTypes: IMAGE_UPLOAD_MIME_TYPES,
    onUploaded: async (result) => {
      const confirmed = await confirmAvatarUpload({
        objectKey: result.objectKey,
        filename: result.filename,
        mimeType: result.mimeType,
        sizeBytes: result.sizeBytes
      })

      if ("error" in confirmed) {
        toast.error(confirmed.error)

        return
      }

      setAvatarStorageKey(confirmed.data.storageKey)

      await refetch({ query: { disableCookieCache: true } })

      router.refresh()
      toast.success(t("settings.profile.avatarUpdated"))
    }
  })

  const handleRemoveAvatar = () => {
    startRemoving(async () => {
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

  return (
    <section className="space-y-4">
      <Typography variant="h4">{t("settings.profile.avatar")}</Typography>
      <div className="flex items-start gap-4">
        <EntityAvatar
          size="lg"
          shape="circle"
          name={user.name}
          src={resolveStorageUrl(avatarStorageKey)}
          alt={user.name}
          className="size-20"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <FileDropzone
            size="compact"
            accept={IMAGE_UPLOAD_MIME_TYPES}
            disabled={isUploading || isRemoving}
            label={t("settings.profile.uploadPhoto")}
            dropLabel={t("settings.profile.dropPhoto")}
            description={t("settings.profile.avatarHelp")}
            onFiles={upload}
          />
          <FileUploadProgressList items={items} locale={locale} onDismiss={dismiss} />
          {avatarStorageKey ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="self-start"
              disabled={isUploading || isRemoving}
              onClick={handleRemoveAvatar}
            >
              {isRemoving && <Spinner />}
              {t("settings.profile.removePhoto")}
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  )
}

export { AvatarSection }
