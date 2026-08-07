import { createInstance } from "i18next"

import ICU from "i18next-icu"

import { beforeAll, expect, test } from "vitest"

import { english } from "@/lib/i18n/locales/en"

import { type ActivityMessageArgs } from "../schemas"
import { type ActivityMessageKey } from "../types"

// A stand-in second language, because Remit ships English only today. The point of the test is not
// the Portuguese copy but that the same persisted row — a key plus ICU arguments, never a rendered
// string — produces both sentences, which is what makes the feed follow a locale change
// (ARCHITECTURE.md, internationalization).
const portuguese = {
  activity: {
    messages: {
      invoicePaid: "A fatura {number} foi marcada como paga",
      invoiceOverdue: "A fatura {number} está {days, plural, one {# dia} other {# dias}} em atraso"
    }
  }
}

// The two fields queries.ts hands the renderer, typed exactly as it types them.
type StoredActivityRow = {
  messageKey: ActivityMessageKey
  messageArgs: ActivityMessageArgs
}

const storedRow: StoredActivityRow = {
  messageKey: "activity.messages.invoicePaid",
  messageArgs: { number: "INV-042" }
}

const overdueRow: StoredActivityRow = {
  messageKey: "activity.messages.invoiceOverdue",
  messageArgs: { number: "INV-042", days: 1 }
}

const i18n = createInstance()

beforeAll(async () => {
  await i18n.use(ICU).init({
    resources: {
      en: { translation: english.translations },
      pt: { translation: portuguese }
    },
    lng: "en",
    fallbackLng: "en",
    defaultNS: "translation",
    initAsync: false,
    interpolation: { escapeValue: false }
  })
})

test("renders one stored row differently in each language", () => {
  const inEnglish = i18n.getFixedT("en")(storedRow.messageKey, storedRow.messageArgs)
  const inPortuguese = i18n.getFixedT("pt")(storedRow.messageKey, storedRow.messageArgs)

  expect(inEnglish).toBe("Invoice INV-042 was marked as paid")
  expect(inPortuguese).toBe("A fatura INV-042 foi marcada como paga")
})

test("applies each language's own plural rules to the stored arguments", () => {
  const inEnglish = i18n.getFixedT("en")(overdueRow.messageKey, overdueRow.messageArgs)
  const inPortuguese = i18n.getFixedT("pt")(overdueRow.messageKey, overdueRow.messageArgs)

  expect(inEnglish).toBe("Invoice INV-042 is 1 day overdue")
  expect(inPortuguese).toBe("A fatura INV-042 está 1 dia em atraso")
})
