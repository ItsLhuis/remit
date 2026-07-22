"use client"

import { useRef, useState, type ChangeEvent } from "react"

import { useTranslation } from "@/lib/i18n"

import { Button, Spinner, toast, Typography } from "@/components/ui"

import { confirmTemplateImageUpload } from "../../mutations"

type ImageBlockFieldProps = {
  hasUpload: boolean
  imageUrl: string | null
  alt: string
  disabled?: boolean
  onUploaded: (uploadId: string, storageKey: string) => void
}

// Template images are upload-only: the block stores an uploads.id, never a URL. This field drives
// the shared presign -> PUT -> confirm flow (the avatar/logo pattern) against the template-image
// upload type.
const ImageBlockField = ({
  hasUpload,
  imageUrl,
  alt,
  disabled,
  onUploaded
}: ImageBlockFieldProps) => {
  const { t } = useTranslation()

  const [isUploading, setIsUploading] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) return

    event.target.value = ""

    setIsUploading(true)

    try {
      const presignResponse = await fetch("/api/upload/template-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          sizeBytes: file.size
        })
      })

      if (!presignResponse.ok) {
        const data: unknown = await presignResponse.json()
        const message =
          typeof data === "object" && data !== null && "error" in data
            ? String((data as Record<string, unknown>).error)
            : t("templates.validation.imageUploadUrlFailed")

        toast.error(message)

        return
      }

      const uploadData = (await presignResponse.json()) as {
        uploadUrl: string
        objectKey: string
      }

      const putResponse = await fetch(uploadData.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file
      })

      if (!putResponse.ok) {
        toast.error(t("templates.validation.imageUploadFailed"))

        return
      }

      const result = await confirmTemplateImageUpload({
        objectKey: uploadData.objectKey,
        filename: file.name,
        contentType: file.type,
        sizeBytes: file.size
      })

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      onUploaded(result.data.uploadId, result.data.storageKey)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {imageUrl ? (
        // Self-hosted instance-local storage asset; next/image optimization does not apply here.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={alt}
          className="border-border max-h-32 w-full rounded-md border object-contain"
        />
      ) : (
        <div className="border-border text-muted-foreground flex h-20 items-center justify-center rounded-md border border-dashed">
          <Typography affects={["muted", "small"]}>{t("templates.editor.imageEmpty")}</Typography>
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        aria-label={t("templates.editor.uploadImage")}
        onChange={handleFileChange}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || isUploading}
        onClick={() => fileInputRef.current?.click()}
      >
        {isUploading && <Spinner />}
        {hasUpload ? t("templates.editor.replaceImage") : t("templates.editor.uploadImage")}
      </Button>
    </div>
  )
}

export { ImageBlockField }
