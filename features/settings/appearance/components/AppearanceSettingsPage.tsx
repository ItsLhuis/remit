"use client"

import { Fragment, type ReactNode } from "react"

import { useTheme } from "next-themes"

import { Kbd, SidebarTrigger, ToggleGroup, ToggleGroupItem, Typography } from "@/components/ui"

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
  <div className="light border-border bg-background flex h-20 w-28 overflow-hidden rounded-md border">
    <PreviewContent />
  </div>
)

const DarkPreview = () => (
  <div className="dark border-border bg-background flex h-20 w-28 overflow-hidden rounded-md border">
    <PreviewContent />
  </div>
)

const SystemPreview = () => (
  <div className="border-border flex h-20 w-28 overflow-hidden rounded-md border">
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

const AppearanceSettingsPage = () => {
  const { theme, setTheme } = useTheme()

  const handleThemeChange = (value: string) => {
    if (!value) return

    setTheme(value)
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
            className="justify-start"
          >
            {themeOptions.map((option) => (
              <ToggleGroupItem
                key={option.value}
                value={option.value}
                className="data-[state=on]:border-primary h-auto flex-col gap-2 p-2"
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
