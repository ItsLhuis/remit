import { type TFunction as I18nTFunction } from "i18next"

import i18n from "./i18n"

export * from "./hooks"
export * from "./locales"
export * from "./resources"
export type * from "./types"

export { i18n }

export type TFunction = I18nTFunction<"translation">
