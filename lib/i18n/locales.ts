import { english } from "./locales/en"

import { type Language } from "./types"

export const Locales = {
  en: english
} as const

export type LocaleKeys = keyof typeof Locales

export const getLocales = (): Record<LocaleKeys, Language> => {
  const result = {} as Record<LocaleKeys, Language>

  for (const key in Locales) {
    result[key as LocaleKeys] = Locales[key as LocaleKeys]
  }

  return result
}
