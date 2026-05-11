"use client"

import { useCopyWithFeedback } from "@/hooks/useCopyWithFeedback"

import { useTranslation } from "@/lib/i18n"

import { CopyIcon, IconButton, Typography } from "@/components/ui"

type ManualEntryCodeProps = {
  secret: string
}

const ManualEntryCode = ({ secret }: ManualEntryCodeProps) => {
  const { t } = useTranslation()

  const { copied: isSecretCopied, copy: copySecret } = useCopyWithFeedback()

  return (
    <div className="dark:bg-input/30 rounded-lg border p-3">
      <Typography affects={["small", "muted"]}>{t("totp.manualEntryCode")}</Typography>
      <div className="mt-1 flex items-center gap-3">
        <Typography
          variant="p"
          affects={["bold", "removePMargin"]}
          className="min-w-0 flex-1 font-mono break-all"
          title={secret}
        >
          {secret}
        </Typography>
        <IconButton
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0"
          onClick={() => copySecret(secret)}
          label={t("totp.copyManualEntryCode")}
        >
          <CopyIcon copied={isSecretCopied} />
        </IconButton>
      </div>
    </div>
  )
}

export { ManualEntryCode }
