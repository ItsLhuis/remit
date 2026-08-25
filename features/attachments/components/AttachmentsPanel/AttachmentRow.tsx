"use client"

import { useTranslation } from "@/lib/i18n"

import { formatBytes, formatDay } from "@/lib/utils"

import { Button, Icon, IconButton, Typography } from "@/components/ui"

import { isPreviewableImage } from "../../services/attachmentPreview"
import { type AttachmentListItem } from "../../types"

function toTypeIconName(mimeType: string): "FileText" | "FileSpreadsheet" | "File" {
  if (mimeType === "application/pdf") return "FileText"
  if (mimeType === "text/csv") return "FileSpreadsheet"

  return "File"
}

type AttachmentRowProps = {
  attachment: AttachmentListItem
  locale: string
  canRemove: boolean
  onRemove: (attachment: AttachmentListItem) => void
}

const AttachmentRow = ({ attachment, locale, canRemove, onRemove }: AttachmentRowProps) => {
  const { t } = useTranslation()

  const downloadUrl = `/api/attachments/${attachment.id}`
  const label = attachment.title ?? attachment.filename

  return (
    <li
      data-slot="attachment-row"
      className="border-border flex items-center gap-3 rounded-lg border p-2"
    >
      {isPreviewableImage(attachment.mimeType) ? (
        // A plain `img`, not `next/image`: the source is the credentialed download route on this
        // instance's own storage, served `no-store`, so the optimizer would add a round trip and
        // cache nothing. `?inline=1` is what makes the route serve it for rendering rather than
        // for saving.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`${downloadUrl}?inline=1`}
          alt={label}
          className="border-border size-10 shrink-0 rounded-md border object-cover"
        />
      ) : (
        <div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-md">
          <Icon
            name={toTypeIconName(attachment.mimeType)}
            className="text-muted-foreground"
            aria-hidden="true"
          />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <Typography affects="small" className="block truncate font-medium">
          {label}
        </Typography>
        <Typography affects={["muted", "tiny"]} className="block truncate">
          {`${formatBytes(attachment.sizeBytes, locale)} · ${formatDay(attachment.createdAt, locale)} · ${
            attachment.uploadedByName
              ? t("attachments.addedBy", { name: attachment.uploadedByName })
              : t("attachments.addedByUnknown")
          }`}
        </Typography>
      </div>
      <Button asChild variant="ghost" size="icon-sm">
        <a
          href={downloadUrl}
          download={attachment.filename}
          aria-label={t("attachments.download", { filename: attachment.filename })}
        >
          <Icon name="Download" aria-hidden="true" />
        </a>
      </Button>
      {canRemove ? (
        <IconButton
          size="icon-sm"
          label={t("attachments.remove", { filename: attachment.filename })}
          onClick={() => onRemove(attachment)}
        >
          <Icon name="Trash2" aria-hidden="true" />
        </IconButton>
      ) : null}
    </li>
  )
}

export { AttachmentRow }
