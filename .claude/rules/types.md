---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# Type Rules

- Always use `type` — never `interface`. Use intersection (`&`) to compose types.
- Never use `any`. Prefer `unknown` for truly unknown values and narrow with type guards.
- Never use non-null assertion (`!`). Narrow to non-null explicitly with a guard or conditional.
- Export types inline on the declaration: `export type Foo = { ... }`. Never include types in a
  bottom `export { }` block.
- Keep file-private types unexported (e.g. `type Step = "a" | "b"` used only within a component or
  hook).
- Use inline `type` modifier for type-only imports: `import { type Foo }` or
  `import { Bar, type Baz }`. Never use a separate `import type { }` statement.
- Every component's props must be a named `type` declared outside the component:
  `type FooProps = { ... }`. Never use inline object types in the function signature.
- Extend HTML element props via `ComponentProps<"element">` from React, not with manual
  `HTMLAttributes` unions.
- When using `cva`, intersect with `VariantProps<typeof variants>` from `class-variance-authority`.
- Always derive form value types from the schema:
  `export type FooValues = z.infer<typeof fooSchema>`. Never define them manually alongside a Zod
  schema.
- Colocate the inferred type immediately after its schema in the same file.
