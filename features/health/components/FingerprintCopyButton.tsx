"use client"

import { useTranslation } from "@/lib/i18n"

import { useCopyWithFeedback } from "@/hooks/useCopyWithFeedback"

import { CopyIcon, IconButton } from "@/components/ui"

type FingerprintCopyButtonProps = {
  fingerprint: string
}

const FingerprintCopyButton = ({ fingerprint }: FingerprintCopyButtonProps) => {
  const { t } = useTranslation()

  const { copied, copy } = useCopyWithFeedback()

  return (
    <IconButton
      type="button"
      variant="outline"
      size="icon-sm"
      onClick={() => copy(fingerprint)}
      label={t("health.fingerprint.copyLabel")}
      tooltip={copied ? t("common.status.copied") : t("health.fingerprint.copyTooltip")}
    >
      <CopyIcon copied={copied} />
    </IconButton>
  )
}

export { FingerprintCopyButton }
