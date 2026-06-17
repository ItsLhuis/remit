---
paths:
  - "components/**/*.tsx"
  - "app/**/*.tsx"
  - "features/**/*.tsx"
---

# Component Rules

## Component files

- Component filenames are PascalCase: `Button.tsx`, `SecuritySettingsPage.tsx`.
- Feature and layout components usually define a named `type ComponentProps = { ... }` immediately
  before the component when props are needed.
- UI primitives may use inline `ComponentProps<...>` intersections in the parameter type when that
  keeps the wrapper compact. Do not force a named props type into an existing UI primitive style.
- Components are normally declared as `const ComponentName = (...) => { ... }` and exported at the
  bottom with `export { ComponentName }`.
- Next.js page/layout/error files follow Next conventions and may use default exports.
- Hook files export the hook directly as a named function; follow `hooks.md` there.

## File-private helpers in `.tsx`

In component files, **arrow functions are components and `function` declarations are helpers.** A
genuinely file-private helper — one that is not generic enough for `lib/utils/` and not domain logic
for `services/` — is declared with a `function` statement placed **immediately after the imports and
before the component's props type / component declaration**, never after the component and never
after the `export`. A reader must encounter a helper before its first call site.

This is the opposite of the `.ts` convention in `code-style.md` ("private helpers below the public
API"), which continues to apply to non-component `.ts` files unchanged. The two conventions are
explicitly scoped: helpers go **above** the component in `.tsx`, **below** the public API in `.ts`.
This placement is the one lint-backed piece of the STRUCTURE layer in `code-style.md` ("Form,
structure, and meaning"): `remit/helper-placement` fails a `.tsx` helper declared after the export.

```tsx
// Good - helper declared above the component it serves
function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
}

const ClientCard = ({ client }: ClientCardProps) => {
  return <Avatar>{getInitials(client.name)}</Avatar>
}

export { ClientCard }

// Bad - helper after the component and after the export; reader meets the call first
const ClientCard = ({ client }: ClientCardProps) => {
  return <Avatar>{getInitials(client.name)}</Avatar>
}

export { ClientCard }

function getInitials(name: string): string {
  // ...
}
```

## Component body shape

Mirror the closest component in the same feature. The common body order is translation/context
hooks, state/form hooks, derived values, handlers, guard returns, JSX return. Keep related state
values adjacent and separate different concerns with a blank line.

Small server components often use an explicit block body with `return`, even when the render is
simple:

```tsx
const EmailSettingsPage = () => {
  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <header className="flex items-center gap-2">
        <SidebarTrigger className="md:hidden" />
        <Typography variant="h2">{t("settings.email.title")}</Typography>
      </header>
    </div>
  )
}
```

UI primitives often use compact expression bodies for simple wrappers:

```tsx
const DialogTrigger = ({ ...props }: ComponentProps<typeof DialogPrimitive.Trigger>) => (
  <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
)
```

## UI primitives

- Add every new `components/ui/` component to `components/ui/index.ts` immediately after creating
  it.
- Add `data-slot="component-name"` to the root element of UI primitives and sub-primitives.
- Use `Slot.Root` from `radix-ui` for the `asChild` pattern, not `@radix-ui/react-slot`.
- Use `cva` for variant-heavy UI primitives, with the variants constant above the component.
- Use `cn(...)` for class composition and keep long Tailwind strings inside the call, following the
  surrounding primitive's wrapping style.
- Use `<Icon name="IconName" />` for Lucide icons. Do not import icons from `lucide-react` directly.
- Tailwind v4 tokens are CSS variables defined in `app/globals.css`. There is no
  `tailwind.config.js`.
- Add new shadcn components with `pnpm shadcn add <component>` when using shadcn as the source.

## Always use UI primitives

Compose application UI from the primitives in `components/ui/index.ts` whenever one fits. This is
the default and it is near-absolute: before writing visual JSX, check the barrel for an existing
primitive and use it instead of recreating badges, buttons, cards, inputs, tooltips, separators,
scroll areas, and similar UI with raw elements. A surface that visually reads as a card is a `Card`
with `CardHeader`, `CardContent`, or `CardFooter`, not a hand-rolled
`<div className="rounded-lg border p-4">`.

The reason is design-system reach: when a token, radius, spacing, or variant changes in
`components/ui/`, every screen built from primitives updates at once. Raw elements silently drift
out of the system and have to be hunted down by hand.

```tsx
// Good - primitive carries the design system
<Card size="sm">
  <CardContent>{children}</CardContent>
</Card>

// Bad - raw element duplicates card styling and will not track design-system changes
<div className="rounded-lg border p-4">{children}</div>
```

```tsx
<Badge variant="secondary">Active</Badge>
```

Raw elements are reserved for genuinely rare cases: there is no suitable primitive, or the surface
must deliberately stay outside the design system. When a needed primitive is missing, prefer adding
or extending one in `components/ui/` over inlining raw markup in a feature. When a raw element is
intentionally kept outside the system, leave a short comment saying why.

## Typography

- Use `Typography` for standalone user-facing text in application components.
- Use raw semantic elements inside UI primitives when the primitive itself owns the semantics, such
  as `FieldDescription` rendering a `p`.
- The `variant` prop controls semantics. Omit it for generic inline text.
- Use `affects` for visual modifiers such as `muted`, `small`, `medium`, `removePMargin`, and arrays
  of modifiers.

```tsx
<Typography variant="h2">{t("settings.appearance.title")}</Typography>
<Typography variant="p" affects={["muted", "removePMargin", "small"]}>
  {t("settings.appearance.themeDescription")}
</Typography>
```

## Decomposition and folders

- Extract distinct visual sections into focused components when they represent reusable or named
  page sections.
- If a component has no colocated sub-components, keep it as `ComponentName.tsx`.
- If a component owns several sub-components, create `ComponentName/ComponentName.tsx` plus sibling
  sub-component files and an `index.ts` for the public component exports.
- Folder `index.ts` files export only the public components consumed from outside that folder.
  Internal-only helpers stay unexported.
- Do not split a tiny wrapper just to satisfy a size rule; split when the surrounding feature uses
  named sections or previews as separate files.

Do not extract a generic settings section or form shell just because several settings pages look
similar. Extract only when state behavior, submit behavior, result handling, and layout semantics
are identical across at least three call sites.

## Fragments and conditionals

Use `Fragment` from React when a component needs a fragment and nearby files do so. Conditional JSX
often uses explicit `: null` when there is an either/or expression. Preserve the local style instead
of converting everything to `&&` or fragment shorthand.
