---
name: Remit
description: Calm, precise, trustworthy business management for independent freelancers
colors:
  indigo-accent: "oklch(0.488 0.243 264.376)"
  indigo-accent-deep: "oklch(0.424 0.199 265.638)"
  canvas-white: "oklch(1 0 0)"
  ink: "oklch(0.145 0 0)"
  surface-raised-dark: "oklch(0.205 0 0)"
  muted-surface: "oklch(0.97 0 0)"
  muted-foreground: "oklch(0.556 0 0)"
  hairline: "oklch(0.922 0 0)"
  success: "oklch(0.596 0.145 163.225)"
  info: "oklch(0.588 0.158 241.966)"
  warning: "oklch(0.666 0.179 58.318)"
  error: "oklch(0.577 0.245 27.325)"
typography:
  display:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.02em"
  body:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
rounded:
  sm: "0.375rem"
  md: "0.5rem"
  lg: "0.625rem"
  xl: "0.875rem"
  pill: "1.625rem"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.indigo-accent}"
    textColor: "{colors.canvas-white}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "0 0.625rem"
    height: "2rem"
  button-secondary:
    backgroundColor: "{colors.muted-surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "0 0.625rem"
    height: "2rem"
  button-outline:
    backgroundColor: "{colors.canvas-white}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "0 0.625rem"
    height: "2rem"
  button-ghost:
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "0 0.625rem"
    height: "2rem"
  input-field:
    backgroundColor: "{colors.canvas-white}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "0.25rem 0.625rem"
    height: "2rem"
  card:
    backgroundColor: "{colors.canvas-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "1rem"
---

# Design System: Remit

## 1. Overview

**Creative North Star: "The Ledger"**

Remit looks like financial-grade infrastructure that happens to be pleasant to use. The governing
image is a ledger: a surface where every figure is exact, every line is accountable, and nothing
shouts. The chrome recedes so the numbers and the work can be trusted. This is a tool people run a
livelihood on, so the design earns trust by being quiet and correct, never by performing.

The system is built on a single restraint: one indigo accent and a small set of semantic states are
the only chroma on screen. Everything else is pure achromatic gray. That restraint is the entire
personality. It makes a paid invoice, an overdue badge, or a destructive confirmation register
instantly, because color is rare and therefore meaningful. Density is compact and operational,
controls default to a 32px height, and surfaces are flat, separated by hairline rings rather than
drop shadows. Depth appears only when something genuinely floats above the page.

What this system explicitly rejects: the generic SaaS startup landing (gradient blobs, hero-metric
templates, gradient text); the playful consumer app (oversized rounding, mascots, candy colors,
bouncy motion); the crypto/neon fintech dashboard (neon-on-black, glow, hype); and legacy accounting
software (dense gray chrome, dated toolbars, joyless tables). The line to walk is serious and
precise without being cold or dated, pleasant without being casual or hyped.

**Key Characteristics:**

- One indigo voice plus semantic states; all other surfaces are pure achromatic gray.
- Flat by default. Hairline rings separate surfaces; shadows are reserved for floating overlays.
- Compact, operational density (2rem default control height), tunable by the user.
- Quiet motion: 300ms ease-outs, a 1px press, no choreography.
- Precision-first: figures, dates, and currency read as exact and accountable.

## 2. Colors

A near-monochrome system: pure achromatic neutrals carrying one saturated indigo accent and four
semantic states. Color is rare on purpose.

### Primary

- **Indigo Accent** (oklch(0.488 0.243 264.376)): The single brand voice. Primary buttons, active
  navigation, focus rings, links, selection, and the data-visualization ramp. In dark mode it
  deepens to **Indigo Deep** (oklch(0.424 0.199 265.638)) to hold contrast against the dark canvas.
  Charts use a monochromatic indigo ramp (light tint through deep) rather than a rainbow, so a chart
  reads as one coherent voice instead of competing hues.

### Neutral

- **Canvas White** (oklch(1 0 0)): The light-mode page and card surface. Pure white, untinted.
- **Ink** (oklch(0.145 0 0)): Primary text in light mode; the page canvas in dark mode.
- **Surface Raised Dark** (oklch(0.205 0 0)): Cards, popovers, and the sidebar in dark mode, lifted
  one step off the near-black canvas.
- **Muted Surface** (oklch(0.97 0 0)): Secondary fills, hover backgrounds, muted panels.
- **Muted Foreground** (oklch(0.556 0 0)): Secondary and supporting text, descriptions,
  placeholders.
- **Hairline** (oklch(0.922 0 0)): Borders, input strokes, dividers. In dark mode borders become a
  translucent white (white at 10%).

The sidebar sits on a faint off-white (oklch(0.985 0 0)) in light mode to separate navigation from
the working canvas without a hard line.

### Semantic

Status colors exist only to communicate state, never decoration. Each has a pale tint background, a
dark readable foreground, a mid muted-foreground, and a saturated border/icon value. Badges and
alerts use the pale tint with dark text, not a solid saturated fill, keeping status calm.

- **Success** (oklch(0.596 0.145 163.225)): Paid, completed, accepted, won.
- **Info** (oklch(0.588 0.158 241.966)): Neutral notices and in-progress states.
- **Warning** (oklch(0.666 0.179 58.318)): Due soon, attention needed, partial states.
- **Error** (oklch(0.577 0.245 27.325)): Overdue, failed, rejected, destructive. Doubles as the
  `destructive` token.

### Named Rules

**The Single Voice Rule.** Indigo and the four semantic states are the only chroma permitted. Every
other pixel is pure achromatic gray. The accent covers roughly 10% of any screen; its rarity is what
makes it mean something.

**The Achromatic Neutral Rule.** Neutrals carry zero chroma (oklch chroma 0). Do not tint grays
toward a hue. The contrast between dead-neutral surfaces and the single saturated accent is the
system's signature.

## 3. Typography

**Display / Body Font:** DM Sans (with system-ui, sans-serif fallback) **Label / Mono Font:**
JetBrains Mono (with ui-monospace fallback), for figures, code, tokens, and fingerprints

**Character:** DM Sans is a geometric humanist sans: clean and contemporary without being trendy or
cold. It carries the entire interface, from headings to labels. JetBrains Mono appears only where
character alignment matters. The user may switch the body family to Inter or a system stack, and may
tune font size (compact / default / comfortable), so type choices must survive substitution.

### Hierarchy

- **Display** (DM Sans, 800, 2.25rem / `text-4xl`, line-height 1.1, tracking tight): Page-level h1.
  Used sparingly, one per screen.
- **Headline** (DM Sans, 600, 1.875rem / `text-3xl`, tracking tight): Section h2, settings page
  titles.
- **Title** (DM Sans, 600, 1.5rem–1.25rem / `text-2xl`–`text-xl`, tracking tight): Card and
  subsection titles. Card titles drop to 1rem medium for compact density.
- **Body** (DM Sans, 400, 1rem / `text-base`, line-height 1.5): Paragraph and reading text. Cap
  reading measure at 65–75ch.
- **Label** (DM Sans, 500, 0.875rem / `text-sm`): The workhorse size. Buttons, inputs, table cells,
  most interface text. Default inline text is `text-sm`.
- **Mono** (JetBrains Mono, 400, 0.875rem): Monetary figures, IDs, code, key fingerprints.

### Named Rules

**The Tracking-Tight Rule.** Every heading uses tight letter-spacing (-0.02em to -0.025em). Body and
label text sit at normal tracking. Headings never run loose.

**The Tabular Figure Rule.** Monetary values, totals, and any column of numbers use tabular,
monospaced alignment so digits line up vertically. A misaligned figure reads as an error in a money
tool.

## 4. Elevation

Remit is flat by default. Resting surfaces do not cast shadows; they are separated from the canvas
by a single hairline ring (1px at foreground/10) or a faint tonal step. Depth is a signal that
something genuinely floats above the page, not a default decoration. The overwhelming majority of
surfaces use `shadow-none`.

### Shadow Vocabulary

- **Floating overlay** (`shadow-md` to `shadow-lg`): Popovers, dropdown menus, command palette,
  dialogs, and tooltips. The only place real shadows appear, because these elements literally sit
  above everything else.
- **Tonal lift** (no shadow, surface step): Cards in dark mode rise via a lighter surface
  (oklch(0.205 0 0)) against the near-black canvas, not via a shadow.

### Named Rules

**The Hairline Rule.** Surfaces separate with a 1px ring at foreground/10, never a heavy border and
never a resting shadow. The ring is quieter than a border and cleaner than elevation.

**The Flat-By-Default Rule.** If it is not floating above the page, it casts no shadow. Shadows are
exclusively for overlays. A card, panel, table, or section that uses a drop shadow at rest is wrong.

## 5. Components

Refined and restrained: compact, flat, hairline-bordered, with quiet state feedback. Controls
default to a 2rem (32px) height and a 0.625rem (10px) `lg` corner radius.

### Buttons

- **Shape:** Gently rounded (0.625rem / `rounded-lg`). Small and icon sizes step down to an 8px
  corner.
- **Primary:** Solid indigo fill, near-white text, `text-sm` medium, ~32px tall (`h-8`). Hover dims
  the fill slightly; press nudges down 1px (`active:translate-y-px`).
- **Secondary:** Soft neutral fill (muted surface) with ink text.
- **Outline:** Canvas background with a hairline border; hover fills with muted surface.
- **Ghost:** No fill at rest; hover fills with muted surface. For low-emphasis and toolbar actions.
- **Destructive:** A 10% red tint with red text, never a solid red fill at rest. The danger reads
  clearly without shouting.
- **Hover / Focus:** All controls share a focus-visible ring: a 3px ring at ring/50 plus a border
  shift. Focus is always visible; outline is never removed without this replacement.

### Cards / Containers

- **Corner Style:** 0.875rem (`rounded-xl`), one step softer than controls.
- **Background:** Canvas white (light) / raised surface (dark).
- **Shadow Strategy:** None. Separated by a 1px ring at foreground/10 (see Elevation).
- **Footer:** A muted (50%) fill with a top hairline, visually closing the card.
- **Internal Padding:** 1rem (`p-4`), tightening to 0.75rem at `size="sm"`. Never nest a card inside
  a card.

### Inputs / Fields

- **Style:** Hairline border, transparent/canvas background, 0.625rem corners, ~32px tall,
  `text-sm`.
- **Focus:** Border shifts to the indigo ring color plus a 3px ring at ring/50. No glow, no bounce.
- **Error:** Border and ring switch to the destructive color (`aria-invalid`). Every field pairs
  with a `FieldLabel` and surfaces errors through `FieldError`.

### Badges (status)

- **Shape:** Full pill (1.625rem / `rounded-4xl`), 20px tall, `text-xs` medium.
- **Status variants:** success / info / warning / error use the pale semantic tint with dark
  semantic text. Every status badge pairs color with a text label and, where used, an icon, so state
  is never conveyed by color alone.

### Navigation

- **Sidebar:** Faint off-white surface (light) / raised dark surface (dark), collapsible to an icon
  rail. The active item carries the indigo accent; `aria-current="page"` reflects real state.
- **Density:** The whole app is user-tunable: density (compact / default / spacious) and font size
  adjust spacing and scale globally via root data attributes.

## 6. Do's and Don'ts

### Do:

- **Do** keep indigo as the single accent, on roughly 10% of any screen. Let the semantic states be
  the only other color.
- **Do** keep neutrals pure achromatic gray (chroma 0). The dead-neutral-plus-one-accent contrast is
  the brand.
- **Do** separate surfaces with a 1px hairline ring (foreground/10), and keep resting surfaces flat.
- **Do** reserve shadows (`shadow-md`/`lg`) for floating overlays only: popovers, dropdowns,
  dialogs, tooltips.
- **Do** align monetary figures with tabular numbers so digits line up; precision is the product.
- **Do** pair every status color with a text label and icon. State is never color alone (WCAG 2.2
  AA).
- **Do** keep a visible focus ring (3px at ring/50) on every interactive control.
- **Do** default to compact controls (2rem height) and respect the user's density and font-size
  settings.
- **Do** tint destructive actions (10% red + red text) at rest; reserve solid emphasis for the final
  confirmation.

### Don't:

- **Don't** build a generic SaaS startup landing: no gradient blobs, no hero-metric template (big
  number, small label, gradient accent), no identical feature-card grids, no gradient text.
- **Don't** drift playful-consumer: no oversized rounding, no mascots, no candy-bright palettes, no
  bouncy or elastic motion.
- **Don't** go crypto/neon fintech: no neon-on-black, no glow effects, no hype aesthetic.
- **Don't** fall into legacy accounting software: no dense gray enterprise chrome, no dated
  toolbars, no joyless tables.
- **Don't** add resting drop shadows to cards, panels, or sections. If it isn't floating, it's flat.
- **Don't** use a colored side-stripe border (border-left/right > 1px) as an accent. Use full
  hairline borders, tints, or leading icons instead.
- **Don't** reach for a modal as the first answer. Exhaust inline and progressive alternatives
  first.
- **Don't** introduce a second accent hue or tint the neutrals. One voice only.
- **Don't** remove an outline without providing the focus-visible ring replacement.
