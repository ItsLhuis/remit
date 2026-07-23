import { initReactI18next } from "react-i18next"

import i18n from "./i18n"

// Guarded because this module is evaluated again on every hot reload and from both the client and
// server graphs; registering the React binding twice makes i18next re-run its init side effects.
if (!i18n.modules.external.includes(initReactI18next)) {
  i18n.use(initReactI18next)
}

// Re-exports the i18next singleton as a default import, the convention documented in i18n.md.
// eslint-disable-next-line import/no-default-export
export default i18n
