"use client"

import { type ReactNode } from "react"

import { useTranslation } from "@/lib/i18n"

import { ToggleGroup, ToggleGroupItem, Typography } from "@/components/ui"

import { useAppearance, type FontFamily } from "@/providers"

import { FontFamilyPreview } from "./FontFamilyPreview"

type FontFamilyOption = {
  value: FontFamily
  label: string
  labelKey?: string
  preview: ReactNode
}

const fontFamilyOptions = [
  {
    value: "sans",
    label: "DM Sans",
    labelKey: undefined,
    preview: <FontFamilyPreview fontFamily="var(--font-sans)" />
  },
  {
    value: "inter",
    label: "Inter",
    labelKey: undefined,
    preview: <FontFamilyPreview fontFamily="var(--font-inter)" />
  },
  {
    value: "system",
    label: "System",
    labelKey: "settings.appearance.fontFamilySystem",
    preview: (
      <FontFamilyPreview fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" />
    )
  }
] as const satisfies readonly FontFamilyOption[]

const FontFamilySection = () => {
  const { t } = useTranslation()

  const { fontFamily, setFontFamily } = useAppearance()

  const handleFontFamilyChange = (value: string) => {
    if (!value) return

    setFontFamily(value as FontFamily)
  }

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <Typography variant="h4">{t("settings.appearance.fontFamily")}</Typography>
        <Typography variant="p" affects={["muted", "removePMargin", "small"]}>
          {t("settings.appearance.fontFamilyDescription")}
        </Typography>
      </div>
      <ToggleGroup
        type="single"
        variant="outline"
        value={fontFamily}
        onValueChange={handleFontFamilyChange}
        spacing={2}
        className="w-full justify-start"
      >
        {fontFamilyOptions.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            className="data-[state=on]:border-primary h-auto max-w-32 flex-1 basis-0 flex-col gap-2 p-2"
          >
            {option.preview}
            <Typography affects="small">
              {option.labelKey ? t(option.labelKey) : option.label}
            </Typography>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </section>
  )
}

export { FontFamilySection }
