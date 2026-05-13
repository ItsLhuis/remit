# ADR-0015: i18next + ICU with TypeScript-typed message keys

- **Status:** Accepted
- **Date:** 2026-05-13

## Context

[Architecture: Internationalization](../ARCHITECTURE.md#15-internationalization) commits Remit to
internationalization infrastructure from day one, initially with English but with structure ready
for additional locales. The stack is i18next, react-i18next, and i18next-icu.

The i18n foundation under `lib/i18n` uses a single `Translations` TypeScript type, locale files that
must satisfy that type, resources for i18next, ICU support, and typed `t` usage through module
augmentation.

Remit includes financial documents, activity logs, setup flows, and settings screens that will
eventually need translation. Activity logs store message keys and ICU arguments so messages can be
rendered in the current locale later.

## Decision

Remit uses i18next with ICU MessageFormat and TypeScript-typed message keys derived from a single
`Translations` type.

## Consequences

### Positive

- The compiler catches missing, extra, and misspelled translation keys.
- ICU messages support plurals and parameters without inventing a custom formatting layer.

### Negative

- Every new user-facing string must be added to the typed translation shape.
- ICU syntax and typed key maintenance add friction for small copy changes.

## Alternatives considered

### Raw strings until more locales exist

This would move faster in the first English-only phase. It was rejected because retrofitting i18n
after UI and activity-log copy spreads is much more expensive.

### URL-based locale routing

Locale prefixes such as `/pt/dashboard` are common for public websites. They were rejected because
Remit is an authenticated application where locale is a user preference, not part of the resource
identity.
