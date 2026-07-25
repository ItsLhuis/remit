"use client"

import { Fragment } from "react"

import Link from "next/link"

import { useTranslation } from "@/lib/i18n"

import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Icon,
  Typography
} from "@/components/ui"

import { useMeasuredWidth } from "../../hooks"
import { TEMPLATE_TYPE_LABEL_KEYS } from "../../labels"
import { type TemplateListItem } from "../../types"

function toPreviewDocument(html: string): string {
  return `<!doctype html><html><head><style>body{margin:0}</style></head><body>${html}</body></html>`
}

type TemplatePreviewDialogProps = {
  template: TemplateListItem | null
  onOpenChange: (open: boolean) => void
}

const TemplatePreviewDialog = ({ template, onOpenChange }: TemplatePreviewDialogProps) => {
  const { t } = useTranslation()

  const { ref, width } = useMeasuredWidth()

  const thumbnail = template?.thumbnail ?? null

  // Documents render at 794px and emails at 600px, so the page is scaled down to the measured
  // width instead of being given one. Never scaled up: a template shown larger than its own output
  // size would misrepresent the document. Zero until the first measurement lands, which is the
  // signal that there is nothing correct to draw yet.
  const scale = thumbnail && width > 0 ? Math.min(1, width / thumbnail.width) : 0

  return (
    <Dialog open={template !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        {template ? (
          <Fragment>
            <DialogHeader>
              <DialogTitle className="truncate">{template.name}</DialogTitle>
              <DialogDescription>{t(TEMPLATE_TYPE_LABEL_KEYS[template.type])}</DialogDescription>
            </DialogHeader>
            <div
              ref={ref}
              className="bg-muted flex min-h-0 flex-1 justify-center overflow-auto rounded-lg p-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {thumbnail ? (
                <div
                  className="ring-foreground/10 shrink-0 overflow-hidden bg-white ring-1"
                  style={{ width: thumbnail.width * scale, height: thumbnail.height * scale }}
                >
                  {scale > 0 ? (
                    <iframe
                      title={t("templates.preview.frameTitle", { name: template.name })}
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
                  ) : null}
                </div>
              ) : (
                <Typography affects={["muted", "small"]} className="self-center py-8">
                  {t("templates.preview.empty")}
                </Typography>
              )}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  {t("common.actions.close")}
                </Button>
              </DialogClose>
              <Button asChild>
                <Link href={`/templates/${template.id}`}>
                  <Icon name="Pencil" aria-hidden="true" />
                  {t("templates.actions.edit")}
                </Link>
              </Button>
            </DialogFooter>
          </Fragment>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

export { TemplatePreviewDialog }
