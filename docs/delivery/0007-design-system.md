# DR-0007: Design system and appearance preferences

- **Status:** Shipped
- **Date:** 2026-06-14
- **Verdict:** Complete
- **Decisions:** —
- **Supersedes:** —
- **Reconstructed:** yes

## What

The shared UI primitive library every feature composes from, the design tokens it reads, and the
appearance settings that let a user change theme, font family, font size and density.

## Why

Remit is one product with dozens of surfaces built over months. Without a primitive library, each
surface reinvents its own badge, card and table, and a token change reaches none of them. The
appearance preferences exist because a tool someone looks at for hours a day should adapt to how
they work, and because a self-hosted product cannot ask its users to accept one designer's density.

## Scope

Included: the primitives in `components/ui/`, the layout components in `components/layout/`, the
Tailwind v4 token layer defined as CSS variables, the shared hooks in `hooks/`, the providers in
`providers/`, and the appearance settings page wiring theme, font family, font size and density.

Excluded: a `tailwind.config.js`. Tailwind v4 tokens are CSS variables in `app/globals.css`, and a
config file would be a second place for the same values. Also excluded is per-user preference
storage on the server — appearance is a per-browser preference held client-side, because a
single-instance product's owner is usually one person on their own machine.

## How

The rule that makes the library worth having is that application UI composes from it rather than
around it: a surface that reads as a card is a `Card`, not a `div` with a border.
`.agents/rules/components.md` states it, and the reason is reach — a token, radius or variant change
in `components/ui/` updates every screen at once, while a raw element silently leaves the system and
has to be hunted down later.

Icons go through one `Icon` primitive rather than direct `lucide-react` imports, so the icon set is
swappable and the name is a compile-time literal rather than a value from runtime data.

`DESIGN.md` holds the palette, type scale and elevation as named values, which is what lets a visual
brief reference a rule rather than a screenshot.

## Evidence

- `components/ui/` and its `index.ts` barrel — 64 primitives
- `components/layout/`, `app/globals.css` — the Tailwind v4 token layer
- `hooks/` and `providers/` with their barrels; `providers/AppearanceProvider.tsx`
- `features/settings/appearance/`
- `DESIGN.md`
- `.agents/rules/components.md`, `.agents/rules/accessibility.md`
- `eslint.config.mjs` and `eslint-rules/` — `remit/helper-placement`,
  `remit/no-blank-lines-in-jsx-return`, `remit/no-unnamed-use-watch`, `remit/no-hook-in-components`

## Verification

`hooks/__tests__/` covers the shared hooks that carry state. The primitives themselves are
deliberately untested per `.agents/rules/testing.md` Tier 5: they are thin wrappers over Radix and
shadcn, and testing them would test those libraries. Structural conformance is enforced by lint
rather than by tests — the custom `remit/*` rules fail a helper declared after its component, a
blank line inside a JSX return, an unnamed `useWatch`, and a hook declared under `components/`.

Not covered: visual regression. There is no screenshot diffing, so a token change that breaks a
layout is caught by review.

## Known gaps

`jsx-a11y/*` rules run at `warn` while an existing backlog is burned down rather than at `error`.
Appearance preferences are per-browser and do not follow a user to another device.
