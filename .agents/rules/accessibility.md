---
paths:
  - "components/**/*.tsx"
  - "features/**/*.tsx"
  - "app/**/*.tsx"
---

# Accessibility Rules

Accessibility is a non-negotiable surface. Every interactive element must be operable without a
mouse, every status must be perceivable without color, and every async state change must be
announced to screen readers.

## Interactive elements

Every clickable or activatable surface is a semantic `<button>`, `<a>`, or `<input>` - never a
`<div>` or `<span>` with an `onClick` handler, even when `role="button"` is added. Use the `Button`
primitive from `components/ui/` for clickable controls; use `<a>` (or Next.js `<Link>`) for
navigation.

```tsx
// ✓
<Button onClick={handleDelete}>Delete</Button>

// ✗ - div with onClick; not keyboard-accessible, no implicit ARIA role
<div onClick={handleDelete} role="button">Delete</div>
```

## Labels

Every `<input>`, `<select>`, and `<textarea>` is paired with a `<FieldLabel htmlFor={...}>` that
references the input's `id`. This is already required by `forms.md` for form fields.

## Icons

Icons that convey information (a standalone icon button, a status icon with no adjacent text) carry
an accessible name via `aria-label` on the wrapping element or visually-hidden text. Purely
decorative icons use `aria-hidden="true"`.

```tsx
// ✓ - icon conveys meaning; accessible name present
<button aria-label="Delete invoice">
  <Icon name="Trash2" aria-hidden="true" />
</button>

// ✗ - icon conveys meaning; no accessible name
<button>
  <Icon name="Trash2" />
</button>

// ✓ - decorative icon beside visible label; hidden from screen readers
<Icon name="CheckCircle" aria-hidden="true" />
<span>Paid</span>
```

## Images

Every `<img>` element has an `alt` attribute. Use `alt=""` for purely decorative images so screen
readers skip them. Meaningful images have a description of their content or purpose.

## Color as the sole signal

Color is never the only way to convey state or meaning. Every color cue is paired with an icon,
label, or text. Status badges always include both a color indicator and a text label; they never
rely on color alone.

## Focus visibility

Focus is always visible. Never apply `outline: none` or `outline: 0` without providing an equivalent
custom focus indicator using `:focus-visible`. The design token `--ring` provides the canonical
focus ring; use it via Tailwind's `ring` utilities.

## Modal and dialog focus

Modals trap focus within the dialog while open and restore focus to the trigger element on close.
Always use the `Dialog` primitive from `components/ui/` - it handles focus trapping and restoration
via Radix UI. Never implement a custom modal with raw `<div>` elements.

## Keyboard-only flows

Every primary action in a feature must be completable without a mouse. A feature is not done if it
requires a hover interaction or a drag that has no keyboard equivalent.

## Live regions

Async state changes visible on screen are announced to screen readers. Toasts are already announced
via the `Toaster` primitive. For inline loading states and dynamic content updates, use
`aria-live="polite"` (or `aria-live="assertive"` for critical errors).

## ARIA state attributes

Components with state machines reflect their state through ARIA attributes. Use `aria-expanded` for
collapsible panels, `aria-selected` for tabs and list items, `aria-current="page"` for navigation
items. These attributes must reflect actual component state, not a hardcoded value.

## Icon name safety

The `Icon` primitive's `name` prop must be a compile-time string literal or a value from a typed
constant set. Never pass a `name` derived from an untrusted runtime source (URL params, user input,
API response without validation).
