---
paths:
  - "components/**/*.tsx"
  - "app/**/*.tsx"
  - "features/**/*.tsx"
---

# Component Rules

- Component filenames are PascalCase: `Button.tsx`, not `button.tsx`.
- Props must be defined as a named type outside the component: `type ComponentProps = { ... }` then
  `const Component = (props: ComponentProps) => ...`. Never use inline object types in the function
  signature.
- Use named export at the bottom of the file: `export { ComponentName }`. No default exports. Never
  use `export` directly on the component declaration - the bottom export is mandatory for
  components.
- Add every new `components/ui/` component to `components/ui/index.ts` immediately after creating
  it.
- Every `features/<name>/components/` folder must have a barrel `index.ts` that re-exports all
  components with `export * from "./ComponentName"`. External callers import from the barrel
  (`@/features/<name>/components`); sibling components within the same feature import by direct path
  (e.g. `@/features/<name>/components/ComponentName`) to avoid circular dependencies.
- Use `Slot.Root` from `radix-ui` for the `asChild` pattern - not from `@radix-ui/react-slot`.
- Add `data-slot="component-name"` to the root element of every UI primitive.
- Use `<Icon name="IconName" />` for all Lucide icons - never import from `lucide-react` directly.
- Tailwind v4: all design tokens are CSS variables defined in `app/globals.css`. There is no
  `tailwind.config.js`.
- Add new shadcn components with `pnpm shadcn add <component>` - do not copy-paste manually.
- Dark mode uses the `dark` class strategy; add both light and dark variant classes inline.
- Never use `<>` shorthand fragments - always use `<Fragment>` from React explicitly.

## Always Prefer Existing UI Components

- Before writing any JSX that renders visual UI, check `components/ui/index.ts` for an existing
  primitive. If one exists, use it - never reimplement it with raw HTML elements or `div`s.
- This applies to every visual concept: badges, buttons, avatars, separators, tooltips, cards,
  inputs, etc.

```tsx
// ✓
<Badge variant="secondary">Active</Badge>

// ✗ - Badge already exists
<div className="rounded-full bg-secondary px-2 py-0.5 text-xs">Active</div>
```

## Typography

- Always use the `Typography` component for standalone text - never raw `<p>`, `<span>`, `<h1>`...
  outside of a UI primitive's internal implementation.
- The `variant` prop sets both the semantic element and its default style (`h1`–`h6`, `p`,
  `blockquote`, `code`, `pre`, `span`). Defaults to `span` when omitted.
- Use `affects` for additional visual modifiers (`muted`, `bold`, `large`, `small`, etc.). Accepts a
  single value or an array for combining modifiers.
- Only pass `variant` when you need a specific semantic element. For generic inline text, omit it
  and rely on the `span` default.

```tsx
// ✓
<Typography variant="h2">Section title</Typography>
<Typography variant="p" affects="muted">Supporting text</Typography>
<Typography affects={["bold", "uppercase"]}>Label</Typography>
<Typography affects="muted">Inline muted text</Typography>

// ✓ - variant overrides semantics when visual hierarchy differs
<Typography variant="h2" affects="large">Visually large but h2</Typography>

// ✗ - never use raw elements for standalone text
<p className="text-sm text-muted-foreground">Some description</p>
<span className="font-bold uppercase">Label</span>
```

## Component decomposition

- Every distinct visual section, preview, or logical group must become its own component - no
  exceptions.
- A component must do exactly one thing. If it renders a labelled section with controls, that
  section is a component; if it renders a preview thumbnail, that is a separate component.
- Prefer many small focused files over fewer large ones - even a 10-line component warrants its own
  file if it has a distinct responsibility. Inline JSX that can be named and extracted must be
  extracted.
- **Single-file rule**: when a component has no sub-components, place it directly as
  `ComponentName.tsx`.
- **Folder rule**: when a component requires its own sub-components, create a `ComponentName/`
  folder. Place `ComponentName.tsx` inside alongside each sub-component file. Add `index.ts` with
  barrel exports for everything consumed from outside the folder.
- Internal helper components (used only within the folder, not by external callers) must not appear
  in the folder's `index.ts`.
- The folder-vs-file trigger is solely whether the component needs co-located sub-components - not
  file size alone.
