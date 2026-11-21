import i18n from "./i18n"

export const t: typeof i18n.t = i18n.t.bind(i18n)
