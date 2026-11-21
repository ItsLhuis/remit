"use client"

import { useTranslation } from "@/lib/i18n"

import { Card, CardContent, CardHeader, CardTitle, Typography } from "@/components/ui"

import { type PublicContractDocument as PublicContractDocumentModel } from "../../types"

type PublicContractDocumentProps = {
  document: PublicContractDocumentModel | null
  number: string
}

// The document the signer is agreeing to, rendered by the same pure renderer that drives the editor
// preview and the PDF job, inside a sandboxed iframe so nothing in the stored block content can
// script against this page. The page is a fixed-width surface, so on a narrow viewport it scrolls
// horizontally inside its own container rather than widening the page around it.
const PublicContractDocument = ({ document, number }: PublicContractDocumentProps) => {
  const { t } = useTranslation()

  const html = document
    ? `<!doctype html><html><head><style>body{margin:0}</style></head><body>${document.html}</body></html>`
    : null

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{t("contracts.public.document.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        {html && document ? (
          <div className="overflow-x-auto">
            <iframe
              title={t("contracts.public.document.frameTitle", { number })}
              sandbox=""
              srcDoc={html}
              style={{ width: document.width, height: document.height }}
              className="ring-foreground/10 block shrink-0 bg-white ring-1"
            />
          </div>
        ) : (
          <Typography affects={["muted", "small"]}>
            {t("contracts.public.document.empty")}
          </Typography>
        )}
      </CardContent>
    </Card>
  )
}

export { PublicContractDocument }
