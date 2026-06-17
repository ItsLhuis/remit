import i18n from "i18next"

import ICU from "i18next-icu"

import { Locales, type LocaleKeys } from "./locales"
import { getTranslationResources } from "./resources"
import { type Translations } from "./types"

declare module "i18next" {
  // Module augmentation requires `interface`; `type` cannot merge into the library declaration.
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
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

// The i18next singleton is consumed as a default import (`import i18n from "@/lib/i18n/i18n"`),
// the convention documented in i18n.md for client-safe schemas and shared modules.
// eslint-disable-next-line import/no-default-export
export default i18n
