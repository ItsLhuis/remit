---
paths:
  - "app/**/*.tsx"
  - "components/**/*.tsx"
  - "features/**/*.tsx"
---

# Form Rules

## Form setup

- Use `Controller` from `react-hook-form` for fields. The existing forms do not use `register`.
- Use `zodResolver` from `@hookform/resolvers/zod`.
- Keep the resolver import, `Controller`/`useForm` import, and local schema import together as one
  form concern.
- Form schemas live in the feature's `schemas.ts` when shared across multiple forms in that feature.
- Auth/login forms use `mode: "onSubmit"`. Setup/profile/settings forms use `mode: "onBlur"` when
  local precedent does.
- Default values are written inline in the `useForm` call unless they are large enough to justify a
  named constant nearby.

```tsx
const form = useForm<LoginValues>({
  resolver: zodResolver(loginSchema),
  mode: "onSubmit",
  defaultValues: { email: "", password: "" }
})

const { isSubmitting, isDirty, isValid } = form.formState
```

## Submit handlers

Name form submit handlers `onSubmit` when they are passed to `form.handleSubmit(onSubmit)`. The
handler usually starts with a validity/dirty guard, clears submit-level errors, awaits the action or
client API call, handles error results, then performs the success transition.

```tsx
const onSubmit = async (values: LoginValues) => {
  if (!isDirty || !isValid) return

  setAuthError(null)

  const result = await saveBusinessProfile(values)

  if ("error" in result) {
    setAuthError(result.error)

    return
  }

  onComplete()
}
```

## Field markup

- Wrap fields with `Field`, `FieldLabel`, and `FieldError` from `@/components/ui`.
- Set `data-invalid={fieldState.invalid}` on `Field`.
- Set `aria-invalid={fieldState.invalid}` on the input/select control when the control supports it.
- Pass `errors={[fieldState.error]}` to `FieldError`; do not extract `.message` manually.
- Existing forms usually render `FieldError` only when `fieldState.invalid` is true.
- Use `field.name` for the input `id` and matching label `htmlFor`.
- Add `noValidate` to every `<form>`.

```tsx
<Controller
  name="email"
  control={form.control}
  render={({ field, fieldState }) => (
    <Field data-invalid={fieldState.invalid}>
      <FieldLabel htmlFor={field.name}>{t("common.fields.email")}</FieldLabel>
      <Input
        {...field}
        id={field.name}
        type="email"
        aria-invalid={fieldState.invalid}
        disabled={isSubmitting}
      />
      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
    </Field>
  )}
/>
```

## Submit buttons and errors

- Disable submit buttons with the same condition used by the form: commonly
  `isSubmitting || !(isDirty && isValid)`.
- Render `<Spinner />` inside the submit button before the label when `isSubmitting` is true.
- Submit-level errors are stored in local state (`serverError`, `authError`) and rendered in
  `FieldError` near the submit area. Current forms commonly place this after the submit button.
- Server actions return already translated errors; render them directly.
