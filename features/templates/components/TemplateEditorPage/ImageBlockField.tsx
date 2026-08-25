"use client"

import { useTranslation } from "@/lib/i18n"

import { FileDropzone, toast, Typography } from "@/components/ui"

import { IMAGE_UPLOAD_MAX_BYTES, IMAGE_UPLOAD_MIME_TYPES, useFileUpload } from "@/hooks"

import { confirmTemplateImageUpload } from "../../mutations"

type ImageBlockFieldProps = {
  hasUpload: boolean
  imageUrl: string | null
  alt: string
  disabled?: boolean
  onUploaded: (uploadId: string, storageKey: string) => void
}

// Template images are upload-only: the block stores an uploads.id, never a URL.
//
// The one deliberate difference from the other three migrated call sites is that this field shows no
// `FileUploadProgressList`. It lives in the canvas editor's inspector panel, a fixed-width column
// beside the canvas, where a growing list would push the rest of the block's controls out of view
// mid-upload. A single image at the 5 MB ceiling finishes fast enough that the dropzone's disabled
// state is the whole feedback it needs; failures still arrive as a toast.
const ImageBlockField = ({
  hasUpload,
  imageUrl,
  alt,
  disabled,
  onUploaded
}: ImageBlockFieldProps) => {
  const { t } = useTranslation()

  const { isUploading, upload } = useFileUpload({
    type: "template-image",
    maxBytes: IMAGE_UPLOAD_MAX_BYTES,
    mimeTypes: IMAGE_UPLOAD_MIME_TYPES,
    onUploaded: async (result) => {
      const confirmed = await confirmTemplateImageUpload({
        objectKey: result.objectKey,
        filename: result.filename,
        contentType: result.mimeType,
        sizeBytes: result.sizeBytes
      })

      if ("error" in confirmed) {
        toast.error(confirmed.error)

        return
      }

      onUploaded(confirmed.data.uploadId, confirmed.data.storageKey)
    }
  })

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
      <FileDropzone
        size="compact"
        accept={IMAGE_UPLOAD_MIME_TYPES}
        disabled={disabled || isUploading}
        label={hasUpload ? t("templates.editor.replaceImage") : t("templates.editor.uploadImage")}
        dropLabel={t("templates.editor.dropImage")}
        onFiles={upload}
      />
    </div>
  )
}

export { ImageBlockField }
