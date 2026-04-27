"use client"

import { type ReactNode } from "react"

import { useAppearance, type FontFamily } from "@/providers/AppearanceProvider"

import { ToggleGroup, ToggleGroupItem, Typography } from "@/components/ui"

import { FontFamilyPreview } from "./FontFamilyPreview"

type FontFamilyOption = {
  value: FontFamily
  label: string
  preview: ReactNode
}

const fontFamilyOptions: FontFamilyOption[] = [
  {
    value: "sans",
    label: "DM Sans",
    preview: <FontFamilyPreview fontFamily="var(--font-sans)" />
  },
  {
    value: "inter",
    label: "Inter",
    preview: <FontFamilyPreview fontFamily="var(--font-inter)" />
  },
  {
    value: "system",
    label: "System",
    preview: (
      <FontFamilyPreview fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" />
    )
  }
]

const FontFamilySection = () => {
  const { fontFamily, setFontFamily } = useAppearance()

  const handleFontFamilyChange = (value: string) => {
    if (!value) return

    setFontFamily(value as FontFamily)
  }

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <Typography variant="h4">Font family</Typography>
        <Typography variant="p" affects={["muted", "removePMargin", "small"]}>
          Choose the typeface used across the interface.
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
            <Typography affects="small">{option.label}</Typography>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </section>
  )
}

export { FontFamilySection }
