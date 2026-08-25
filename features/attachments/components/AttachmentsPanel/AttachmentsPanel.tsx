"use client"

import { useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import { useTranslation } from "@/lib/i18n"

import { formatBytes } from "@/lib/utils"

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  FileDropzone,
  FileUploadProgressList,
  Icon,
  toast,
  Typography
} from "@/components/ui"

import { useFileUpload } from "@/hooks"

import { addAttachment, removeAttachment } from "../../mutations"
import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_MAX_PER_RECORD,
  ATTACHMENT_MIME_TYPES,
  type AttachmentParent
} from "../../schemas"
import { type AttachmentListItem } from "../../types"

import { AttachmentRow } from "./AttachmentRow"
import { DeleteAttachmentDialog } from "./DeleteAttachmentDialog"

type AttachmentsPanelProps = {
  parent: AttachmentParent
  attachments: AttachmentListItem[]
  locale: string
  canWrite: boolean
}

const AttachmentsPanel = ({ parent, attachments, locale, canWrite }: AttachmentsPanelProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [deleting, setDeleting] = useState<AttachmentListItem | null>(null)
  const [isRemoving, startRemoving] = useTransition()

  const { items, isUploading, upload, dismiss } = useFileUpload({
    type: "attachment",
    maxBytes: ATTACHMENT_MAX_BYTES,
    mimeTypes: ATTACHMENT_MIME_TYPES,
    onUploaded: async (result) => {
      const persisted = await addAttachment({ ...parent, ...result })

      if ("error" in persisted) {
        toast.error(persisted.error)

        return
      }

      router.refresh()
    }
  })

  const isFull = attachments.length >= ATTACHMENT_MAX_PER_RECORD

  const handleRemove = () => {
    if (!deleting) return

    startRemoving(async () => {
      const result = await removeAttachment({ id: deleting.id })

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      setDeleting(null)
      toast.success(t("attachments.removed"))
      router.refresh()
    })
  }

  const dropzone = canWrite ? (
    <FileDropzone
      accept={ATTACHMENT_MIME_TYPES}
      multiple
      disabled={isUploading || isFull}
      size={attachments.length > 0 ? "compact" : "default"}
      label={t("attachments.label")}
      dropLabel={t("attachments.dropLabel")}
      description={t("attachments.help", {
        count: ATTACHMENT_MAX_PER_RECORD,
        size: formatBytes(ATTACHMENT_MAX_BYTES, locale)
      })}
      onFiles={upload}
    />
  ) : null

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-2">
        <Typography variant="h4">{t("attachments.title")}</Typography>
        <Typography affects={["muted", "tiny"]}>
          {t("attachments.countLabel", { count: attachments.length })}
        </Typography>
      </header>
      {attachments.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Icon name="Paperclip" aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>{t("attachments.empty.title")}</EmptyTitle>
            <EmptyDescription>{t("attachments.empty.description")}</EmptyDescription>
          </EmptyHeader>
          {dropzone}
        </Empty>
      ) : (
        <ul className="flex flex-col gap-2">
          {attachments.map((attachment) => (
            <AttachmentRow
              key={attachment.id}
              attachment={attachment}
              locale={locale}
              canRemove={canWrite}
              onRemove={setDeleting}
            />
          ))}
        </ul>
      )}
      <FileUploadProgressList items={items} locale={locale} onDismiss={dismiss} />
      {attachments.length > 0 ? dropzone : null}
      <DeleteAttachmentDialog
        filename={deleting?.filename ?? ""}
        open={deleting !== null}
        isDeleting={isRemoving}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        onConfirm={handleRemove}
      />
    </section>
  )
}

export { AttachmentsPanel }
