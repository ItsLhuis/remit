---
paths:
  - "hooks/**/*.ts"
  - "features/**/*.ts"
---

# Hook Rules

- Hook filenames are camelCase: `useMyHook.ts`, not `UseMyHook.ts`.
- Hooks must be declared as named functions: `export function useMyHook() { ... }`. Never use arrow
  function syntax (`const useMyHook = () => ...`).
- Export directly on the function declaration — never use a separate `export { }` block at the
  bottom.
- Shared hooks live in `hooks/`. Feature-scoped hooks live alongside their feature components.
