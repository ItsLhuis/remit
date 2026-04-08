"use client"

import { ComponentProps } from "react"

import { useHotkey } from "@tanstack/react-hotkeys"

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes"

const ThemeProvider = ({ children, ...props }: ComponentProps<typeof NextThemesProvider>) => {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      <ThemeHotkey />
      {children}
    </NextThemesProvider>
  )
}

const ThemeHotkey = () => {
  const { resolvedTheme, setTheme } = useTheme()

  useHotkey("D", () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
  })

  return null
}

export { ThemeProvider }
