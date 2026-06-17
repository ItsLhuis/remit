"use client"

import { type ReactNode } from "react"

import { useTranslation } from "@/lib/i18n"

import { ToggleGroup, ToggleGroupItem, Typography } from "@/components/ui"

import { useAppearance, type Density } from "@/providers"

import { DensityPreview } from "./DensityPreview"

type DensityOption = {
  value: Density
  labelKey: string
  preview: ReactNode
}

const densityOptions = [
  {
    value: "compact",
    labelKey: "settings.appearance.densityCompact",
    preview: <DensityPreview gap="3px" />
  },
  {
    value: "default",
    labelKey: "settings.appearance.densityDefault",
    preview: <DensityPreview gap="6px" />
  },
  {
    value: "spacious",
    labelKey: "settings.appearance.densitySpacious",
    preview: <DensityPreview gap="10px" />
  }
] as const satisfies readonly DensityOption[]

const DensitySection = () => {
  const { t } = useTranslation()

  const { density, setDensity } = useAppearance()

  const handleDensityChange = (value: string) => {
    if (!value) return

    setDensity(value as Density)
  }

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <Typography variant="h4">{t("settings.appearance.density")}</Typography>
        <Typography variant="p" affects={["muted", "removePMargin", "small"]}>
          {t("settings.appearance.densityDescription")}
        </Typography>
      </div>
      <ToggleGroup
        type="single"
        variant="outline"
        value={density}
        onValueChange={handleDensityChange}
        spacing={2}
        className="w-full justify-start"
      >
        {densityOptions.map((option) => (
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

export { DensitySection }
