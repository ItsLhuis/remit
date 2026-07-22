"use client"

import { useMemo } from "react"

import { useTranslation } from "@/lib/i18n"

import { Typography } from "@/components/ui"

import { type Block, type TemplatePageSettings, type TemplateType } from "../../schemas"
import {
  getPageHeight,
  getPageWidth,
  renderTemplate,
  type TemplateRenderData
} from "../../services"

type TemplatePreviewProps = {
  blocks: Block[]
  type: TemplateType
  pageSettings: TemplatePageSettings
  renderData: TemplateRenderData
  assets: Record<string, string>
  zoom: number
}

// The preview is the renderer's real output at the template's real output size - the same absolute
// page the canvas draws (getPageWidth x getPageHeight) at the editor's current zoom, inside a
// sandboxed iframe sized exactly to the page so nothing scrolls. The wrapping shell is static
// renderer-controlled markup (the sanitized fragment goes in the body); body margins are zeroed so
// the page fills the iframe edge to edge.
const TemplatePreview = ({
  blocks,
  type,
  pageSettings,
  renderData,
  assets,
  zoom
}: TemplatePreviewProps) => {
  const { t } = useTranslation()

  const pageWidth = getPageWidth(type)
  const pageHeight = getPageHeight(blocks, type, pageSettings)

  const html = useMemo(() => {
    const page = renderTemplate({ blocks, renderData, type, format: "html", pageSettings, assets })

    return `<!doctype html><html><head><style>body{margin:0}</style></head><body>${page}</body></html>`
  }, [blocks, renderData, type, pageSettings, assets])

  return (
    <div className="bg-muted min-h-0 flex-1 overflow-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex justify-center px-16 py-12" style={{ zoom }}>
        {blocks.length === 0 ? (
          <Typography affects={["muted", "small"]}>{t("templates.editor.previewEmpty")}</Typography>
        ) : (
          <iframe
            title={t("templates.editor.previewTitle")}
            sandbox=""
            srcDoc={html}
            style={{ width: pageWidth, height: pageHeight }}
            className="ring-foreground/10 shrink-0 bg-white ring-1"
          />
        )}
      </div>
    </div>
  )
}

export { TemplatePreview }
