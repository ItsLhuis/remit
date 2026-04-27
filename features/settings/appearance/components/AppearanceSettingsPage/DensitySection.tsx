"use client"

import { type ReactNode } from "react"

import { useAppearance, type Density } from "@/providers/AppearanceProvider"

import { ToggleGroup, ToggleGroupItem, Typography } from "@/components/ui"

import { DensityPreview } from "./DensityPreview"

type DensityOption = {
  value: Density
  label: string
  preview: ReactNode
}

const densityOptions: DensityOption[] = [
  { value: "compact", label: "Compact", preview: <DensityPreview gap="3px" /> },
  { value: "default", label: "Default", preview: <DensityPreview gap="6px" /> },
  { value: "spacious", label: "Spacious", preview: <DensityPreview gap="10px" /> }
]

const DensitySection = () => {
  const { density, setDensity } = useAppearance()

  const handleDensityChange = (value: string) => {
    if (!value) return

    setDensity(value as Density)
  }

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <Typography variant="h4">Density</Typography>
        <Typography variant="p" affects={["muted", "removePMargin", "small"]}>
          Control the spacing and padding throughout the interface.
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
            <Typography affects="small">{option.label}</Typography>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </section>
  )
}

export { DensitySection }
