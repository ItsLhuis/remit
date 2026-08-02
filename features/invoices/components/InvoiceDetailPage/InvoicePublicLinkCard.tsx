"use client"

import { useTranslation } from "@/lib/i18n"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Icon,
  IconButton,
  Input,
  Typography,
  toast
} from "@/components/ui"

type InvoicePublicLinkCardProps = {
  publicPath: string | null
}

const InvoicePublicLinkCard = ({ publicPath }: InvoicePublicLinkCardProps) => {
  const { t } = useTranslation()

  const onCopy = () => {
    if (!publicPath) return

    void navigator.clipboard
      .writeText(`${window.location.origin}${publicPath}`)
      .then(() => toast.success(t("invoices.detail.linkCopied")))
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{t("invoices.detail.publicLinkTitle")}</CardTitle>
        <CardDescription>{t("invoices.detail.publicLinkDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        {publicPath ? (
          <div className="flex items-center gap-2">
            <Input readOnly value={publicPath} aria-label={t("invoices.detail.publicLinkTitle")} />
            <IconButton variant="outline" label={t("invoices.detail.copyLink")} onClick={onCopy}>
              <Icon name="Copy" />
            </IconButton>
          </div>
        ) : (
          <Typography variant="p" affects={["muted", "small", "removePMargin"]}>
            {t("invoices.detail.publicLinkHidden")}
          </Typography>
        )}
      </CardContent>
    </Card>
  )
}

export { InvoicePublicLinkCard }
