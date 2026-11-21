"use client"

import { type ReactNode } from "react"

import { useTranslation } from "@/lib/i18n"

import { ToggleGroup, ToggleGroupItem, Typography } from "@/components/ui"

import { useAppearance, type FontSize } from "@/providers"

import { FontSizePreview } from "./FontSizePreview"

type FontSizeOption = {
  value: FontSize
  labelKey: string
  preview: ReactNode
}

const fontSizeOptions = [
  {
    value: "compact",
    labelKey: "settings.appearance.fontSizeCompact",
    preview: <FontSizePreview textSize="11px" />
  },
  {
    value: "default",
    labelKey: "settings.appearance.fontSizeDefault",
    preview: <FontSizePreview textSize="14px" />
  },
  {
    value: "comfortable",
    labelKey: "settings.appearance.fontSizeComfortable",
    preview: <FontSizePreview textSize="18px" />
  }
] as const satisfies readonly FontSizeOption[]

const FontSizeSection = () => {
  const { t } = useTranslation()

  const { fontSize, setFontSize } = useAppearance()

  const handleFontSizeChange = (value: string) => {
    if (!value) return

    setFontSize(value as FontSize)
  }

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <Typography variant="h4">{t("settings.appearance.fontSize")}</Typography>
        <Typography variant="p" affects={["muted", "removePMargin", "small"]}>
          {t("settings.appearance.fontSizeDescription")}
        </Typography>
      </div>
      <ToggleGroup
        type="single"
        variant="outline"
        value={fontSize}
        onValueChange={handleFontSizeChange}
        spacing={2}
        className="w-full justify-start"
      >
        {fontSizeOptions.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            className="data-[state=on]:border-primary h-auto max-w-32 flex-1 basis-0 flex-col gap-2 p-2"
          >
            {option.preview}
            <Typography affects="small">{t(option.labelKey)}</Typography>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </section>
  )
}

export { FontSizeSection }
