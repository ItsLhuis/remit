---
paths:
  - "hooks/**/*.ts"
  - "hooks/**/*.tsx"
  - "features/**/*.ts"
  - "features/**/*.tsx"
---

# Hook Rules

- Hook filenames are camelCase: `useMyHook.ts`, not `UseMyHook.ts`. Use `.tsx` only when the hook
  itself returns or composes JSX (rare); the default extension is `.ts`.
- Hooks must be declared as named functions: `export function useMyHook() { ... }`. Never use arrow
  function syntax (`const useMyHook = () => ...`).
- Export directly on the function declaration; never use a separate `export { }` block at the
  bottom.
- Shared hooks live in `hooks/`. Feature-scoped hooks live alongside their feature components.
- `hooks/` carries an `index.ts` barrel (`export * from "./useX"`, alphabetized), like every other
  shared folder. Consumers import through it (`import { useIsMobile } from "@/hooks"`), never by
  direct file path. Sibling hooks inside `hooks/` import each other by direct relative path
  (`./useX`), not through the barrel, to avoid a self-cycle. See `imports.md`.

Shared hooks are for behavior reused across features. If the hook depends on a feature's schema,
translation namespace, mutation, or component state model, keep it feature-scoped until at least
three features share the same behavior.

Non-trivial hooks that carry state, effects, subscriptions, keyboard behavior, or async behavior
need focused tests.
