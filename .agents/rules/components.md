# Component Rules

## What belongs in `components/`

A file belongs in `features/<feature>/components/` only when it is:

1. a **React component**, or
2. a **module-private contract** consumed only by sibling components in the same folder, carrying no
   reusable domain logic and no React state (`TemplateEditorPage/layerDropId.ts`, the dnd-kit id
   vocabulary `LayerRow` registers and `LayersList` decodes, is the canonical one).

Everything else has a home:

| The file is...                              | Home                           |
| ------------------------------------------- | ------------------------------ |
| a hook (`use*`, calls React hooks)          | `features/<feature>/hooks/`    |
| pure domain logic, no React and no IO       | `features/<feature>/services/` |
| a domain value → label / icon / variant map | `features/<feature>/labels.ts` |
| the canvas editor's pointer runtime         | `features/templates/engine/`   |

Extension follows content (JSX makes it `.tsx`), never the folder; classify by kind.
`TemplatesListPage/columns.ts` (a config function rendering no JSX) and
`ClientsListPage/columns.tsx` are the same kind and both correctly co-located. Lint-enforced from
both sides: `remit/no-hook-in-components` fails an exported `use*` function under
`features/**/components/**`; `remit/hook-file-exports-its-hook` fails a `hooks/` file named `use*`
that does not export that hook.

## Component files

- PascalCase filenames (`Button.tsx`, `SecuritySettingsPage.tsx`).
- Feature and layout components define a named `type ComponentProps = { ... }` immediately before
  the component. UI primitives may use inline `ComponentProps<...>` intersections; do not force a
  named props type into an existing primitive style.
- Components are `const ComponentName = (...) => { ... }`, exported at the bottom with
  `export { ComponentName }`. Next.js page/layout/error files follow Next conventions and may use
  default exports.
- Hook files follow `hooks.md`.

## File-private helpers in `.tsx`

In component files, arrow functions are components and `function` declarations are helpers. A
file-private helper (not generic enough for `lib/utils/`, not domain logic for `services/`) is a
`function` statement placed immediately after the imports, before the props type and the component —
never after the component or the export, so a reader meets the helper before its first call. This is
the opposite of the `.ts` convention ("private helpers below the public API" in `code-style.md`).
Enforced by `remit/helper-placement`.

## Component body shape

Follow the body-section order in `code-style.md` ("React component body structure"). Small server
components often use a block body with `return` even for a simple render; UI primitives often use
compact expression bodies for simple wrappers. Keep related state adjacent and separate concerns
with one blank line.

## UI primitives

- Add every new `components/ui/` component to `components/ui/index.ts` immediately.
- Add `data-slot="component-name"` to the root element of every primitive and sub-primitive.
- Use `Slot.Root` from `radix-ui` for `asChild`, not `@radix-ui/react-slot`.
- Use `cva` for variant-heavy primitives, with the variants constant above the component.
- Compose classes with `cn(...)`, following the surrounding primitive's wrapping style.
- Use `<Icon name="IconName" />` for Lucide icons; never import from `lucide-react` directly.
- Tailwind v4 tokens are CSS variables in `app/globals.css`; there is no `tailwind.config.js`.
- Add shadcn components with `pnpm shadcn add <component>`.

## Always use UI primitives

Compose application UI from `components/ui/index.ts` whenever a primitive fits. Before writing
visual JSX, check the barrel: badges, buttons, cards, inputs, tooltips, separators and scroll areas
are primitives. A surface that reads as a card is a `Card` with `CardHeader`/`CardContent`/
`CardFooter`, never a hand-rolled `<div className="rounded-lg border p-4">`. Why: when a token,
radius, spacing or variant changes in `components/ui/`, every screen built from primitives updates
at once; raw elements drift out of the system.

Raw elements are reserved for the rare case with no suitable primitive or a surface that must stay
outside the design system. Prefer adding or extending a primitive over inlining raw markup, and
leave a short comment saying why when a raw element is kept on purpose.

## Typography

- Use `Typography` for standalone user-facing text in application components; primitives that own
  their semantics (`FieldDescription` rendering a `p`) use raw elements.
- `variant` controls semantics; omit it for generic inline text.
- `affects` carries visual modifiers (`muted`, `small`, `medium`, `removePMargin`, or an array).

## Decomposition and folders

- Extract distinct visual sections into focused components when they are reusable or named page
  sections; this is also how a JSX return is sectioned (no blank lines inside it).
- A component with no colocated sub-components stays `ComponentName.tsx`; one that owns several
  becomes `ComponentName/ComponentName.tsx` plus siblings and an `index.ts` exporting only what is
  consumed outside the folder.
- Do not split a tiny wrapper just to satisfy a size rule.
- Do not extract a generic settings section or form shell until state, submit, result handling and
  layout semantics are identical across at least three call sites.

## Watch named fields, not the whole form

`useWatch({ control })` with no `name` subscribes to every field, so one keystroke re-renders the
component and everything below it. Name the fields the component reads, and put the `useWatch` in
the component that reads them rather than at the form root (a value watched at the root re-renders
every sibling). Enforced by `remit/no-unnamed-use-watch` under `features/**/components/**`.
`ProposalPricingSection` and `InvoicePricingSection` are the canonical shape; their rows are
`memo`'d because a document-level discount makes every row's total depend on every other row.

## Fragments and conditionals

Use `Fragment` from React when a component needs one and nearby files do. Conditional JSX often uses
explicit `: null`; preserve the local style rather than converting to `&&` or fragment shorthand.

## Comments

A component earns four kinds of comment and no others: a deliberate accessibility deviation, a
render-cost decision, a third-party quirk it works around, and a deliberate escape from the design
system. See `comments.md` ("Components and JSX").
