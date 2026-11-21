"use client"

import { useTranslation } from "@/lib/i18n"

import { cn } from "@/lib/utils"

import { resolveStorageUrl } from "@/lib/storage"

import { Icon } from "@/components/ui"

type ExpenseReceiptLinkProps = {
  filename: string
  objectKey: string
  className?: string
}

const ExpenseReceiptLink = ({ filename, objectKey, className }: ExpenseReceiptLinkProps) => {
  const { t } = useTranslation()

  const url = resolveStorageUrl(objectKey)

  if (!url)
    return <span className={cn("text-muted-foreground text-sm", className)}>{filename}</span>

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("expenses.receipt.open", { filename })}
      className={cn(
        "text-foreground hover:text-primary inline-flex min-w-0 items-center gap-1.5 text-sm underline-offset-4 hover:underline",
        className
      )}
    >
      <Icon name="Paperclip" className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{filename}</span>
    </a>
  )
}

export { ExpenseReceiptLink }
