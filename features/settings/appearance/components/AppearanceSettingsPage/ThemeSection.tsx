"use client"

import { type ReactNode } from "react"

import { useTheme } from "next-themes"

import { Kbd, ToggleGroup, ToggleGroupItem, Typography } from "@/components/ui"

import { DarkPreview } from "./DarkPreview"
import { LightPreview } from "./LightPreview"
import { SystemPreview } from "./SystemPreview"

type ThemeOption = {
  value: string
  label: string
  preview: ReactNode
}

const themeOptions: ThemeOption[] = [
  { value: "system", label: "System", preview: <SystemPreview /> },
  { value: "light", label: "Light", preview: <LightPreview /> },
  { value: "dark", label: "Dark", preview: <DarkPreview /> }
]

const ThemeSection = () => {
  const { theme, setTheme } = useTheme()

  const handleThemeChange = (value: string) => {
    if (!value) return

    setTheme(value)
  }

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Typography variant="h4">Interface theme</Typography>
          <Kbd>D</Kbd>
        </div>
        <Typography variant="p" affects={["muted", "removePMargin", "small"]}>
          Select your preferred interface theme.
        </Typography>
      </div>
      <ToggleGroup
        type="single"
        variant="outline"
        value={theme}
        onValueChange={handleThemeChange}
        spacing={2}
        className="w-full justify-start"
      >
        {themeOptions.map((option) => (
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

export { ThemeSection }
