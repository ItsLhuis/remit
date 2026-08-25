"use client"

import { useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import { useTranslation } from "@/lib/i18n"

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

import { confirmClientImageUpload, removeClientImage } from "../../imageMutations"

type ClientImageSectionProps = {
  clientId: string
  clientName: string
  imageStorageKey: string | null
  locale: string
  canWrite: boolean
}

const ClientImageSection = ({
  clientId,
  clientName,
  imageStorageKey,
  locale,
  canWrite
}: ClientImageSectionProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [storageKey, setStorageKey] = useState<string | null>(imageStorageKey)
  const [isRemoving, startRemoving] = useTransition()

  const { items, isUploading, upload, dismiss } = useFileUpload({
    type: "client-image",
    maxBytes: IMAGE_UPLOAD_MAX_BYTES,
    mimeTypes: IMAGE_UPLOAD_MIME_TYPES,
    onUploaded: async (result) => {
      const confirmed = await confirmClientImageUpload({
        clientId,
        objectKey: result.objectKey,
        filename: result.filename,
        contentType: result.mimeType,
        sizeBytes: result.sizeBytes
      })

      if ("error" in confirmed) {
        toast.error(confirmed.error)

        return
      }

      setStorageKey(confirmed.data.storageKey)

      router.refresh()
      toast.success(t("clients.image.updated"))
    }
  })

  const handleRemove = () => {
    startRemoving(async () => {
      const result = await removeClientImage({ id: clientId })

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      setStorageKey(null)

      router.refresh()
      toast.success(t("clients.image.removed"))
    })
  }

  return (
    <section className="flex flex-col gap-4">
      <Typography variant="h4">{t("clients.image.label")}</Typography>
      <div className="flex items-start gap-4">
        <EntityAvatar
          size="lg"
          name={clientName}
          src={resolveStorageUrl(storageKey)}
          alt={t("clients.image.alt", { name: clientName })}
          className="size-20"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {canWrite ? (
            <FileDropzone
              size="compact"
              accept={IMAGE_UPLOAD_MIME_TYPES}
              disabled={isUploading || isRemoving}
              label={t("clients.image.upload")}
              dropLabel={t("clients.image.dropLabel")}
              description={t("clients.image.help")}
              onFiles={upload}
            />
          ) : null}
          <FileUploadProgressList items={items} locale={locale} onDismiss={dismiss} />
          {canWrite && storageKey ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="self-start"
              disabled={isUploading || isRemoving}
              onClick={handleRemove}
            >
              {isRemoving && <Spinner />}
              {t("clients.image.remove")}
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  )
}

export { ClientImageSection }
