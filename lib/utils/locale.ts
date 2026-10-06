// The BCP 47 tags a record may carry as its formatting locale, which every `lib/utils/format.ts`
// helper hands straight to `Intl`. A closed list rather than "any tag `Intl` accepts", because
// `Intl` silently falls back to its default locale for a tag it does not recognise, so an accepted
// typo would format exactly like the instance default and look as though it had been ignored. Each
// tag here names a region, since the region is what decides separators, currency placement and date
// order; it is unrelated to the UI languages `lib/i18n/locales.ts` ships.
export const FORMATTING_LOCALES = [
  "cs-CZ",
  "da-DK",
  "de-AT",
  "de-CH",
  "de-DE",
  "en-AU",
  "en-CA",
  "en-GB",
  "en-IE",
  "en-IN",
  "en-NZ",
  "en-US",
  "es-ES",
  "es-MX",
  "fi-FI",
  "fr-BE",
  "fr-CA",
  "fr-CH",
  "fr-FR",
  "it-IT",
  "ja-JP",
  "ko-KR",
  "nb-NO",
  "nl-BE",
  "nl-NL",
  "pl-PL",
  "pt-BR",
  "pt-PT",
  "sv-SE",
  "zh-CN"
] as const

export type FormattingLocale = (typeof FORMATTING_LOCALES)[number]

export function isFormattingLocale(value: string): value is FormattingLocale {
  return (FORMATTING_LOCALES as readonly string[]).includes(value)
}
