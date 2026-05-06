import { initReactI18next } from "react-i18next"

import i18n from "./i18n"

if (!i18n.modules.external.includes(initReactI18next)) {
  i18n.use(initReactI18next)
}

export default i18n
