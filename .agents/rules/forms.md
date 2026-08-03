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

## Transforming schemas: resolve with `raw: true`

`zodResolver` defaults to `raw: false`, so `handleSubmit` receives the schema's **transformed
output**, not the values the controls hold. When a form schema and its server action's schema are
built from the same field shape — the shape every document feature uses, `invoiceFieldsShape`,
`proposalFieldsShape`, `projectFieldsShape`, `taskFieldsShape` — sending that output makes the
action's re-parse fail at the trust boundary with `expected string, received number`. Resolve with
`raw: true` so the strings travel and the transform runs once, on the server:

```tsx
const form = useForm<InvoiceFormInputValues>({
  resolver: zodResolver(invoiceFormSchema, {}, { raw: true }),
  mode: "onChange",
  defaultValues
})
```

Drop the third `useForm` generic when you do: with `raw: true` the input shape is what travels, so
`useForm<XFormInputValues>` is the whole contract and the output type has no call site.

The exception is a form whose schema is a deliberate **bridge** into a differently shaped action
schema. `features/contracts` is the only one: `contractFormSchema` owns the string shape the
controls hold and transforms it into the nullable uuids and `Date`s `createContractSchema` expects,
because a select with nothing chosen is `""` and the domain shape wants `null`. That form resolves
_without_ `raw`, and adding it there would send `""` where a uuid is required.

Splitting every feature's form and action schemas the way contracts does was considered and
rejected: it would restate every field and every validation message twice for no gain, which
`code-style.md` bans under "do not extract shared schema fragments". One shape validated on both
sides, with `raw: true` deciding only _where_ the transform runs, keeps a single source of truth.
Each feature's `__tests__/schemas.test.ts` pins the resulting contract.

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

## Shared form orchestration

Only extract shared form orchestration after at least three forms share identical state, submit, and
result behavior. Keep schema-specific validation local.

Do not extract only because forms share:

- `react-hook-form` setup.
- A pending state.
- A submit button.
- A server-error area.
- A similar settings page section.

Extract only when the behavior is identical enough that the call site does not need many callbacks,
flags, or special cases to recover feature-specific behavior.

If schema fragments repeat, extract them only when field meaning, trimming/null handling,
translation keys, and error semantics are identical. Otherwise keep the validation local and
readable.
