"use client"

import { type ReactNode } from "react"

import { useAppearance, type FontSize } from "@/providers/AppearanceProvider"

import { ToggleGroup, ToggleGroupItem, Typography } from "@/components/ui"

import { FontSizePreview } from "./FontSizePreview"

type FontSizeOption = {
  value: FontSize
  label: string
  preview: ReactNode
}

const fontSizeOptions: FontSizeOption[] = [
  { value: "compact", label: "Compact", preview: <FontSizePreview textSize="11px" /> },
  { value: "default", label: "Default", preview: <FontSizePreview textSize="14px" /> },
  { value: "comfortable", label: "Comfortable", preview: <FontSizePreview textSize="18px" /> }
]

const FontSizeSection = () => {
  const { fontSize, setFontSize } = useAppearance()

  const handleFontSizeChange = (value: string) => {
    if (!value) return

    setFontSize(value as FontSize)
  }

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <Typography variant="h4">Font size</Typography>
        <Typography variant="p" affects={["muted", "removePMargin", "small"]}>
          Adjust the base font size of the interface.
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
            <Typography affects="small">{option.label}</Typography>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </section>
  )
}

export { FontSizeSection }
