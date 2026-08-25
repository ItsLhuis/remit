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

import { confirmBusinessLogoUpload, removeBusinessLogo } from "../../mutations"

type LogoSectionProps = {
  businessName: string
  businessLogoStorageKey: string | null
  locale: string
}

const LogoSection = ({ businessName, businessLogoStorageKey, locale }: LogoSectionProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [logoStorageKey, setLogoStorageKey] = useState<string | null>(businessLogoStorageKey)
  const [isRemoving, startRemoving] = useTransition()

  const displayName = businessName || t("settings.business.fallbackBusinessName")

  const { items, isUploading, upload, dismiss } = useFileUpload({
    type: "business-logo",
    maxBytes: IMAGE_UPLOAD_MAX_BYTES,
    mimeTypes: IMAGE_UPLOAD_MIME_TYPES,
    onUploaded: async (result) => {
      const confirmed = await confirmBusinessLogoUpload({
        objectKey: result.objectKey,
        filename: result.filename,
        contentType: result.mimeType,
        sizeBytes: result.sizeBytes
      })

      if ("error" in confirmed) {
        toast.error(confirmed.error)

        return
      }

      setLogoStorageKey(confirmed.data.storageKey)

      router.refresh()
      toast.success(t("settings.business.logoUpdated"))
    }
  })

  const handleRemoveLogo = () => {
    startRemoving(async () => {
      const result = await removeBusinessLogo()

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      setLogoStorageKey(null)

      router.refresh()
      toast.success(t("settings.business.logoRemoved"))
    })
  }

  return (
    <section className="space-y-4">
      <Typography variant="h4">{t("settings.business.logo")}</Typography>
      <div className="flex items-start gap-4">
        <EntityAvatar
          size="lg"
          name={displayName}
          src={resolveStorageUrl(logoStorageKey)}
          alt={t("settings.business.logoAlt", { name: displayName })}
          className="size-20"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <FileDropzone
            size="compact"
            accept={IMAGE_UPLOAD_MIME_TYPES}
            disabled={isUploading || isRemoving}
            label={t("settings.business.uploadLogo")}
            dropLabel={t("settings.business.dropLogo")}
            description={t("settings.business.logoHelp")}
            onFiles={upload}
          />
          <FileUploadProgressList items={items} locale={locale} onDismiss={dismiss} />
          {logoStorageKey ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="self-start"
              disabled={isUploading || isRemoving}
              onClick={handleRemoveLogo}
            >
              {isRemoving && <Spinner />}
              {t("settings.business.removeLogo")}
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  )
}

export { LogoSection }
