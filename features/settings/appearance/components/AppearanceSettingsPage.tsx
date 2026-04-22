"use client"

import { Fragment, type ReactNode } from "react"

import { useTheme } from "next-themes"

import {
  useAppearance,
  type Density,
  type FontFamily,
  type FontSize
} from "@/providers/AppearanceProvider"

import {
  Kbd,
  Separator,
  SidebarTrigger,
  ToggleGroup,
  ToggleGroupItem,
  Typography
} from "@/components/ui"

const PreviewContent = () => (
  <Fragment>
    <div className="bg-sidebar flex w-9 flex-col gap-1.5 p-2">
      <div className="bg-sidebar-primary h-1.5 w-full rounded-sm" />
      <div className="bg-muted h-1.5 w-full rounded-sm" />
      <div className="bg-muted h-1.5 w-3/4 rounded-sm" />
      <div className="bg-muted h-1.5 w-2/3 rounded-sm" />
    </div>
    <div className="flex flex-1 flex-col gap-1.5 p-2">
      <div className="flex items-center justify-between">
        <div className="bg-muted h-1.5 w-2/5 rounded-sm" />
        <div className="bg-primary h-2 w-6 rounded-sm" />
      </div>
      <div className="bg-border h-px w-full" />
      <div className="bg-muted h-1.5 w-3/4 rounded-sm" />
      <div className="bg-muted h-1.5 w-1/2 rounded-sm" />
      <div className="bg-muted h-1.5 w-2/3 rounded-sm" />
    </div>
  </Fragment>
)

const LightPreview = () => (
  <div className="light border-border bg-background flex h-20 w-full overflow-hidden rounded-md border">
    <PreviewContent />
  </div>
)

const DarkPreview = () => (
  <div className="dark border-border bg-background flex h-20 w-full overflow-hidden rounded-md border">
    <PreviewContent />
  </div>
)

const SystemPreview = () => (
  <div className="border-border flex h-20 w-full overflow-hidden rounded-md border">
    <div className="dark bg-background flex flex-1 flex-col gap-1.5 p-2">
      <div className="flex items-center justify-between">
        <div className="bg-muted h-1.5 w-2/5 rounded-sm" />
        <div className="bg-primary h-2 w-5 rounded-sm" />
      </div>
      <div className="bg-border h-px w-full" />
      <div className="bg-muted h-1.5 w-3/4 rounded-sm" />
      <div className="bg-muted h-1.5 w-1/2 rounded-sm" />
      <div className="bg-muted h-1.5 w-2/3 rounded-sm" />
    </div>
    <div className="light bg-background flex flex-1 flex-col gap-1.5 p-2">
      <div className="flex items-center justify-between">
        <div className="bg-muted h-1.5 w-2/5 rounded-sm" />
        <div className="bg-primary h-2 w-5 rounded-sm" />
      </div>
      <div className="bg-border h-px w-full" />
      <div className="bg-muted h-1.5 w-3/4 rounded-sm" />
      <div className="bg-muted h-1.5 w-1/2 rounded-sm" />
      <div className="bg-muted h-1.5 w-2/3 rounded-sm" />
    </div>
  </div>
)

type FontSizePreviewProps = {
  textSize: string
}

const FontSizePreview = ({ textSize }: FontSizePreviewProps) => (
  <div className="border-border bg-background flex h-16 w-full items-center justify-center overflow-hidden rounded-md border">
    <span style={{ fontSize: textSize }} className="text-foreground leading-none font-medium">
      Aa
    </span>
  </div>
)

type DensityPreviewProps = {
  gap: string
}

const DensityPreview = ({ gap }: DensityPreviewProps) => (
  <div
    className="border-border bg-background flex h-16 w-full flex-col items-start justify-center overflow-hidden rounded-md border px-3"
    style={{ gap }}
  >
    <div className="bg-muted h-1.5 w-full rounded-sm" />
    <div className="bg-muted h-1.5 w-3/4 rounded-sm" />
    <div className="bg-muted h-1.5 w-1/2 rounded-sm" />
  </div>
)

type FontFamilyPreviewProps = {
  fontFamily: string
}

const FontFamilyPreview = ({ fontFamily }: FontFamilyPreviewProps) => (
  <div className="border-border bg-background flex h-16 w-full items-center justify-center overflow-hidden rounded-md border">
    <span style={{ fontFamily }} className="text-foreground text-xl leading-none font-medium">
      Ag
    </span>
  </div>
)

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

const AppearanceSettingsPage = () => {
  const { theme, setTheme } = useTheme()

  const { fontSize, setFontSize, density, setDensity, fontFamily, setFontFamily } = useAppearance()

  const handleThemeChange = (value: string) => {
    if (!value) return

    setTheme(value)
  }

  const handleFontSizeChange = (value: string) => {
    if (!value) return

    setFontSize(value as FontSize)
  }

  const handleDensityChange = (value: string) => {
    if (!value) return

    setDensity(value as Density)
  }

  const handleFontFamilyChange = (value: string) => {
    if (!value) return

    setFontFamily(value as FontFamily)
  }

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <header className="flex items-center gap-2">
        <SidebarTrigger className="md:hidden" />
        <Typography variant="h2">Appearance</Typography>
      </header>
      <div className="space-y-8">
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
        <Separator />
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
        <Separator />
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
        <Separator />
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
      </div>
    </div>
  )
}

export { AppearanceSettingsPage }
