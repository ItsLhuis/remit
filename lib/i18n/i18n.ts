import i18n from "i18next"
import ICU from "i18next-icu"

import { Locales, type LocaleKeys } from "./locales"

import { getTranslationResources } from "./resources"

import { type Translations } from "./types"

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation"
    resources: {
      translation: Translations
    }
  }
}

if (!i18n.isInitialized) {
  void i18n.use(ICU).init({
    resources: getTranslationResources(),
    lng: "en",
    fallbackLng: "en",
    supportedLngs: Object.keys(Locales) as LocaleKeys[],
    defaultNS: "translation",
    debug: process.env.NODE_ENV === "development",
    initAsync: false,
    interpolation: {
      escapeValue: false
    }
  })
}

export default i18n
