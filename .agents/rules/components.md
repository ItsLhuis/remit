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

## Existing UI components first

Before writing visual JSX, check `components/ui/index.ts` for an existing primitive. Use the
primitive instead of recreating badges, buttons, cards, inputs, tooltips, separators, scroll areas,
and similar UI with raw elements.

```tsx
<Badge variant="secondary">Active</Badge>
```

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

## Fragments and conditionals

Use `Fragment` from React when a component needs a fragment and nearby files do so. Conditional JSX
often uses explicit `: null` when there is an either/or expression. Preserve the local style instead
of converting everything to `&&` or fragment shorthand.
