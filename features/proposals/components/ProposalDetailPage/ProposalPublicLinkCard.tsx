"use client"

import { useTranslation } from "@/lib/i18n"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Icon,
  Input,
  IconButton,
  Typography,
  toast
} from "@/components/ui"

type ProposalPublicLinkCardProps = {
  publicPath: string | null
}

const ProposalPublicLinkCard = ({ publicPath }: ProposalPublicLinkCardProps) => {
  const { t } = useTranslation()

  const onCopy = () => {
    if (!publicPath) return

    void navigator.clipboard
      .writeText(`${window.location.origin}${publicPath}`)
      .then(() => toast.success(t("proposals.detail.linkCopied")))
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{t("proposals.detail.publicLinkTitle")}</CardTitle>
        <CardDescription>{t("proposals.detail.publicLinkDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        {publicPath ? (
          <div className="flex items-center gap-2">
            <Input readOnly value={publicPath} aria-label={t("proposals.detail.publicLinkTitle")} />
            <IconButton variant="outline" label={t("proposals.detail.copyLink")} onClick={onCopy}>
              <Icon name="Copy" />
            </IconButton>
          </div>
        ) : (
          <Typography variant="p" affects={["muted", "small", "removePMargin"]}>
            {t("proposals.detail.publicLinkHidden")}
          </Typography>
        )}
      </CardContent>
    </Card>
  )
}

export { ProposalPublicLinkCard }
