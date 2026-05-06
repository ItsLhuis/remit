import { t } from "@/lib/i18n/server"

type FontFamilyPreviewProps = {
  fontFamily: string
}

const FontFamilyPreview = ({ fontFamily }: FontFamilyPreviewProps) => (
  <div className="border-border bg-background flex h-16 w-full items-center justify-center overflow-hidden rounded-md border">
    <span style={{ fontFamily }} className="text-foreground text-xl leading-none font-medium">
      {t("settings.appearance.fontFamilySample")}
    </span>
  </div>
)

export { FontFamilyPreview }
