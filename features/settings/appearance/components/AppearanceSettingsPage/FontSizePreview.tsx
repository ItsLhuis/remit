import { t } from "@/lib/i18n/server"

type FontSizePreviewProps = {
  textSize: string
}

const FontSizePreview = ({ textSize }: FontSizePreviewProps) => (
  <div className="border-border bg-background flex h-16 w-full items-center justify-center overflow-hidden rounded-md border">
    <span style={{ fontSize: textSize }} className="text-foreground leading-none font-medium">
      {t("settings.appearance.fontSizeSample")}
    </span>
  </div>
)

export { FontSizePreview }
