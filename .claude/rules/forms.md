---
paths:
  - "app/**/*.tsx"
  - "components/**/*.tsx"
---

# Form Rules

- Use `Controller` from `react-hook-form` for every field - never use `register`.
- Use `zodResolver` from `@hookform/resolvers/zod` for validation.
- Colocate all Zod schemas and their inferred types in a `schemas.ts` file next to the form
  component, or at `features/<name>/schemas.ts` when the schema is shared across multiple components
  in that feature.
- Shared schemas live in the feature that owns the concept (e.g. `totpVerifySchema` lives in
  `features/settings/schemas.ts`). Other features re-export them rather than duplicating:
  `export { totpVerifySchema, type TotpVerifyValues } from "@/features/settings/schemas"`.
- Wrap each field with `Field`, `FieldLabel`, and `FieldError` from `@/components/ui`.
- Set `data-invalid={fieldState.invalid}` on `Field` and `aria-invalid={fieldState.invalid}` on the
  input element.
- Pass `errors={[fieldState.error]}` to `FieldError` - do not extract `.message` manually.
- Auth/login forms use `mode: "onSubmit"`. Setup/profile/configuration forms use `mode: "onBlur"`.
- Add `noValidate` to every `<form>` element.
- Disable the submit button and render `<Spinner />` inside it when `isSubmitting` is true.
- Surface server-side errors via `form.setError(field, { message })` or a local state variable
  rendered in `FieldError`.
