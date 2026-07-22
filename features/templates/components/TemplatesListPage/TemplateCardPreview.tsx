"use client"

import { useTranslation } from "@/lib/i18n"

import { Icon, Typography } from "@/components/ui"

import { type TemplateThumbnail } from "../../types"

// The paper the thumbnail is scaled onto. Documents render at 794px and emails at 600px, so scaling
// both to one width is what puts every card on the same footprint regardless of template type.
const THUMBNAIL_WIDTH = 240

function toPreviewDocument(html: string): string {
  return `<!doctype html><html><head><style>body{margin:0}</style></head><body>${html}</body></html>`
}

type TemplateCardPreviewProps = {
  thumbnail: TemplateThumbnail | null
  name: string
}

const TemplateCardPreview = ({ thumbnail, name }: TemplateCardPreviewProps) => {
  const { t } = useTranslation()

  if (!thumbnail) {
    return (
      <div className="bg-muted flex h-48 flex-col items-center justify-center gap-2">
        <Icon name="FileText" className="text-muted-foreground size-5" aria-hidden="true" />
        <Typography affects={["muted", "small"]}>{t("templates.card.noPreview")}</Typography>
      </div>
    )
  }

  const scale = THUMBNAIL_WIDTH / thumbnail.width

  return (
    <div className="bg-muted flex h-48 justify-center overflow-hidden pt-4">
      <div
        className="ring-foreground/10 shrink-0 overflow-hidden bg-white ring-1"
        style={{ width: THUMBNAIL_WIDTH, height: thumbnail.height * scale }}
      >
        <iframe
          title={t("templates.card.previewTitle", { name })}
          sandbox=""
          loading="lazy"
          srcDoc={toPreviewDocument(thumbnail.html)}
          tabIndex={-1}
          style={{
            width: thumbnail.width,
            height: thumbnail.height,
            transform: `scale(${scale})`,
            transformOrigin: "top left"
          }}
          className="pointer-events-none border-0"
        />
      </div>
    </div>
  )
}

export { TemplateCardPreview }
