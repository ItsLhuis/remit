"use client"

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"

export type FontSize = "compact" | "default" | "comfortable"
export type Density = "compact" | "default" | "spacious"
export type FontFamily = "sans" | "inter" | "system"

const FONT_SIZES: readonly FontSize[] = ["compact", "default", "comfortable"]
const DENSITIES: readonly Density[] = ["compact", "default", "spacious"]
const FONT_FAMILIES: readonly FontFamily[] = ["sans", "inter", "system"]

const STORAGE_KEY_FONT_SIZE = "font-size"
const STORAGE_KEY_DENSITY = "density"
const STORAGE_KEY_FONT_FAMILY = "font-family"

const ATTRIBUTE_FONT_SIZE = "data-font-size"
const ATTRIBUTE_DENSITY = "data-density"
const ATTRIBUTE_FONT_FAMILY = "data-font-family"

const DEFAULT_FONT_SIZE: FontSize = "default"
const DEFAULT_DENSITY: Density = "default"
const DEFAULT_FONT_FAMILY: FontFamily = "sans"

type AppearanceContextValue = {
  fontSize: FontSize
  setFontSize: (value: FontSize) => void
  density: Density
  setDensity: (value: Density) => void
  fontFamily: FontFamily
  setFontFamily: (value: FontFamily) => void
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null)

const readStored = <Value extends string>(
  key: string,
  allowed: readonly Value[],
  fallback: Value
): Value => {
  if (typeof window === "undefined") return fallback

  const stored = window.localStorage.getItem(key)

  if (stored && (allowed as readonly string[]).includes(stored)) return stored as Value

  return fallback
}

const writeStored = (key: string, value: string) => {
  if (typeof window === "undefined") return

  window.localStorage.setItem(key, value)
}

const writeAttribute = (name: string, value: string) => {
  if (typeof document === "undefined") return

  document.documentElement.setAttribute(name, value)
}

type AppearanceProviderProps = {
  children: ReactNode
}

const AppearanceProvider = ({ children }: AppearanceProviderProps) => {
  const [fontSize, setFontSizeState] = useState<FontSize>(() =>
    readStored(STORAGE_KEY_FONT_SIZE, FONT_SIZES, DEFAULT_FONT_SIZE)
  )
  const [density, setDensityState] = useState<Density>(() =>
    readStored(STORAGE_KEY_DENSITY, DENSITIES, DEFAULT_DENSITY)
  )
  const [fontFamily, setFontFamilyState] = useState<FontFamily>(() =>
    readStored(STORAGE_KEY_FONT_FAMILY, FONT_FAMILIES, DEFAULT_FONT_FAMILY)
  )

  useEffect(() => {
    writeAttribute(ATTRIBUTE_FONT_SIZE, fontSize)
    writeStored(STORAGE_KEY_FONT_SIZE, fontSize)
  }, [fontSize])

  useEffect(() => {
    writeAttribute(ATTRIBUTE_DENSITY, density)
    writeStored(STORAGE_KEY_DENSITY, density)
  }, [density])

  useEffect(() => {
    writeAttribute(ATTRIBUTE_FONT_FAMILY, fontFamily)
    writeStored(STORAGE_KEY_FONT_FAMILY, fontFamily)
  }, [fontFamily])

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY_FONT_SIZE) {
        setFontSizeState(readStored(STORAGE_KEY_FONT_SIZE, FONT_SIZES, DEFAULT_FONT_SIZE))

        return
      }

      if (event.key === STORAGE_KEY_DENSITY) {
        setDensityState(readStored(STORAGE_KEY_DENSITY, DENSITIES, DEFAULT_DENSITY))

        return
      }

      if (event.key === STORAGE_KEY_FONT_FAMILY) {
        setFontFamilyState(readStored(STORAGE_KEY_FONT_FAMILY, FONT_FAMILIES, DEFAULT_FONT_FAMILY))
      }
    }

    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [])

  const setFontSize = useCallback((value: FontSize) => setFontSizeState(value), [])
  const setDensity = useCallback((value: Density) => setDensityState(value), [])
  const setFontFamily = useCallback((value: FontFamily) => setFontFamilyState(value), [])

  return (
    <AppearanceContext
      value={{ fontSize, setFontSize, density, setDensity, fontFamily, setFontFamily }}
    >
      {children}
    </AppearanceContext>
  )
}

export function useAppearance() {
  const context = useContext(AppearanceContext)

  if (!context) throw new Error("useAppearance must be used within an AppearanceProvider")

  return context
}

export { AppearanceProvider }
