"use client"

import { type ComponentProps } from "react"

import { useTranslation } from "@/lib/i18n"

import { cn, formatBytes } from "@/lib/utils"

import { Icon } from "@/components/ui/Icon"
import { IconButton } from "@/components/ui/IconButton"
import { Spinner } from "@/components/ui/Spinner"
import { Typography } from "@/components/ui/Typography"

import { type FileUploadItem } from "@/hooks"

type FileUploadProgressListProps = ComponentProps<"ul"> & {
  items: readonly FileUploadItem[]
  locale: string
  onDismiss: (id: string) => void
}

// The in-flight half of an upload surface: what `useFileUpload` is currently doing, not what the
// record already holds. It is `aria-live="polite"` because the only signal that a file finished or
// failed is this list changing, and a keyboard user who dropped four files has no other way to learn
// which of them landed (accessibility.md).
//
// A failed item stays until dismissed rather than disappearing. In a multi-file batch the failure is
// usually about one file, and clearing it would leave the user with no way to see which.
const FileUploadProgressList = ({
  items,
  locale,
  className,
  onDismiss,
  ...props
}: FileUploadProgressListProps) => {
  const { t } = useTranslation()

  if (items.length === 0) return null

  return (
    <ul
      data-slot="file-upload-progress-list"
      aria-live="polite"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    >
      {items.map((item) => (
        <li
          key={item.id}
          data-slot="file-upload-progress-item"
          data-status={item.status}
          className="border-border flex items-center gap-3 rounded-lg border p-2"
        >
          {item.status === "uploading" ? <Spinner /> : null}
          {item.status === "done" ? (
            <Icon name="CircleCheck" className="text-success size-4 shrink-0" aria-hidden="true" />
          ) : null}
          {item.status === "error" ? (
            <Icon
              name="TriangleAlert"
              className="text-destructive size-4 shrink-0"
              aria-hidden="true"
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <Typography affects="small" className="block truncate">
              {item.filename}
            </Typography>
            <Typography affects={["muted", "tiny"]} className="block">
              {item.status === "error"
                ? item.error
                : t("fileUpload.progress", {
                    percent: item.progress,
                    size: formatBytes(item.sizeBytes, locale)
                  })}
            </Typography>
          </div>
          <IconButton
            size="icon-sm"
            label={t("fileUpload.dismiss", { filename: item.filename })}
            onClick={() => onDismiss(item.id)}
          >
            <Icon name="X" aria-hidden="true" />
          </IconButton>
        </li>
      ))}
    </ul>
  )
}

export { FileUploadProgressList }
