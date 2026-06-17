---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# Type Rules

- Use `type` aliases rather than `interface`.
- Never use `any`. Prefer `unknown` for unknown external input and narrow it before use.
- Avoid non-null assertions; `@typescript-eslint/no-non-null-assertion` is set to `error` for
  `features/`, `app/`, `components/`, `hooks/`, `lib/`, and `providers/`, so a `!` in that code
  fails lint. Narrow explicitly instead. Existing library-bound code may still contain isolated `!`;
  do not copy it into new application code.
- Export reusable types inline on their declaration: `export type Foo = { ... }`.
- Keep file-private types unexported.
- Use inline `type` modifiers for type-only imports: `import { type ReactNode } from "react"` or
  `import { Button, type ButtonProps } from "@/components/ui"`.
- Components in feature and layout code normally use a named props type immediately before the
  component.
- UI primitives may use inline `ComponentProps<...>` intersections in the parameter type when the
  surrounding primitive does that.
- Extend HTML element props via `ComponentProps<"element">` from React.
- When using `cva`, compose with `VariantProps<typeof variants>` from `class-variance-authority`.
- Derive form value types from Zod schemas with `z.infer<typeof schema>` and place the type
  immediately after the schema.

```ts
export const accountDetailsSchema = z.object({
  name: z.string().min(1, t("settings.profile.validation.nameRequired")),
  email: z.email(t("settings.profile.validation.emailInvalid"))
})

export type AccountDetailsValues = z.infer<typeof accountDetailsSchema>
```

## Local type placement

Put small support types near the code they explain:

- Component prop types immediately before the component.
- Config/result/input types before the service functions that use them.
- Private helper input types immediately before the helper when only that helper uses them.
- Public exported types at the top of small utility modules when they are part of the module API.

## Shared helper contracts

Shared helpers need precise contracts. If a utility accepts `string | null`, trims input, treats
empty strings as `null`, or preserves whitespace, that behavior must be visible in its type and
tests.

Do not create a broad generic type just to share similar settings upsert or changed-field helpers.
If the comparable value unions, return columns, or error behavior differ, keep the types local until
there is one stable shared contract.

Use discriminated union or explicit result types for service decisions when a caller must branch on
the outcome:

```ts
export type InvoiceStatusTransition =
  | { allowed: true; nextStatus: InvoiceStatus }
  | { allowed: false; reason: string }
```

Avoid boolean-plus-optional-field result shapes when a discriminated union would make invalid states
unrepresentable. Switches over these unions must be exhaustive
(`@typescript-eslint/switch-exhaustiveness-check`); a missing case fails lint.
