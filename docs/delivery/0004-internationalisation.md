# DR-0004: Internationalisation

- **Status:** Shipped
- **Date:** 2026-05-16
- **Verdict:** Complete
- **Decisions:** ADR-0015
- **Supersedes:** —
- **Reconstructed:** yes

## What

i18next with ICU message formatting and TypeScript-typed message keys, wired into server components,
server actions, client components and client-safe Zod schemas.

## Why

Remit targets independent freelancers in markets where the invoice, the proposal and the tax
vocabulary are not English. Retrofitting translation onto a shipped product means finding every
string, and the ones that hide best are the validation messages and the server action errors. Doing
it first, with the compiler enforcing it, makes adding a locale purely additive.

## Scope

Included: the typed `Translations` key set, the English locale, the server entrypoint for server
components and actions, the `useTranslation` hook for client components, the raw i18next singleton
for modules that can be imported from either side, and ICU pluralisation and interpolation.

Excluded: a second locale. English ships first and the infrastructure is the deliverable; a locale
added without a speaker to review it would be worse than none. Also excluded is runtime locale
negotiation from the browser — the instance has one configured locale, because a single-instance
product has one operator.

## How

The typed key set is the whole point of ADR-0015: `t("...")` with a key that is not in
`lib/i18n/types.ts` fails typecheck, so a missing translation is a build failure rather than a
string rendered as its own key in production.

The three entrypoints are not interchangeable and the split matters. Server code uses
`@/lib/i18n/server`. Client components use the hook. A module that both sides import — a Zod schema
whose validation messages must be translated — uses `lib/i18n/i18n.ts` directly, because importing
the server entrypoint from a client-safe schema pulls server-only code into the client bundle.

i18next is initialised synchronously. Asynchronous initialisation left `t()` undefined while a
schema module was still evaluating, which is exactly when validation messages are constructed.

## Evidence

- `lib/i18n/types.ts` — the `Translations` key set
- `lib/i18n/locales/en.tsx`, `lib/i18n/i18n.ts`, `lib/i18n/server.ts`, `lib/i18n/hooks.ts`,
  `lib/i18n/config.ts`
- `.agents/rules/i18n.md` — the three-entrypoint rule and the two-step key addition
- `eslint.config.mjs` — `i18next/no-literal-string` in `jsx-text-only` mode
- `docs/architecture/adr/0015-i18next-typed-keys.md`

## Verification

The compiler is the primary gate: the locale object must satisfy `Translations`, so a key present in
one and absent from the other fails typecheck. `i18next/no-literal-string` fails lint on hardcoded
JSX text. Component tests across the settings and auth forms assert rendered strings resolve rather
than falling back to raw keys.

Not covered: non-JSX strings — object keys, `data-*` values, URLs — are outside the lint rule's
scope and remain the author's responsibility. There is no test that every ICU message parses.

## Known gaps

Only English exists. No test asserts ICU message validity for keys carrying parameters.
