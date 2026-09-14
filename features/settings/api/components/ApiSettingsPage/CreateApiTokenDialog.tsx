"use client"

import { Fragment, useEffect, useState, useTransition } from "react"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import {
  Button,
  Checkbox,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  Input,
  SecretReveal,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  toast
} from "@/components/ui"

import { API_TOKEN_SCOPES } from "@/features/api"

import { apiTokenScopeLabelKeys } from "../../labels"
import { createApiToken } from "../../mutations"
import {
  API_TOKEN_EXPIRY_OPTIONS,
  createApiTokenSchema,
  type CreateApiTokenInputValues
} from "../../schemas"
import { type ApiTokenListItem } from "../../types"

// No scope is pre-selected: the owner ticks what the integration needs, rather than un-ticking what
// it does not, so a token nobody thought about carries nothing.
const emptyTokenValues: CreateApiTokenInputValues = {
  name: "",
  scopes: [],
  expiry: "90"
}

type CreateApiTokenDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (token: ApiTokenListItem) => void
}

const CreateApiTokenDialog = ({ open, onOpenChange, onCreated }: CreateApiTokenDialogProps) => {
  const { t } = useTranslation()

  const [serverError, setServerError] = useState<string | null>(null)
  const [revealedToken, setRevealedToken] = useState<string | null>(null)

  const [isCreating, startCreating] = useTransition()

  const form = useForm<CreateApiTokenInputValues>({
    resolver: zodResolver(createApiTokenSchema, {}, { raw: true }),
    mode: "onChange",
    defaultValues: emptyTokenValues
  })

  const { isValid } = form.formState

  const submitDisabled = isCreating || !isValid

  const onSubmit = (values: CreateApiTokenInputValues) => {
    if (submitDisabled) return

    setServerError(null)

    startCreating(async () => {
      const result = await createApiToken(values)

      if ("error" in result) {
        setServerError(result.error)

        return
      }

      setRevealedToken(result.data.secret)
      onCreated(result.data.token)

      toast.success(t("settings.api.created"))
    })
  }

  // Closing drops the revealed token from state as well as hiding it, so nothing reopening the
  // dialog later can show it a second time.
  const onDialogOpenChange = (nextOpen: boolean) => {
    if (isCreating) return

    if (!nextOpen) {
      setRevealedToken(null)
      setServerError(null)
    }

    onOpenChange(nextOpen)
  }

  useEffect(() => {
    if (open) form.reset(emptyTokenValues)
  }, [open, form])

  return (
    <Dialog open={open} onOpenChange={onDialogOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {revealedToken ? (
          <Fragment>
            <DialogHeader>
              <DialogTitle>{t("settings.api.revealTitle")}</DialogTitle>
              <DialogDescription>{t("settings.api.revealDescription")}</DialogDescription>
            </DialogHeader>
            <SecretReveal
              id="api-token-value"
              label={t("settings.api.revealLabel")}
              value={revealedToken}
              warningTitle={t("settings.api.revealWarningTitle")}
              warningDescription={t("settings.api.revealWarningDescription")}
              copyLabel={t("settings.api.copy")}
              copiedLabel={t("settings.api.copied")}
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button">{t("common.actions.done")}</Button>
              </DialogClose>
            </DialogFooter>
          </Fragment>
        ) : (
          <Fragment>
            <DialogHeader>
              <DialogTitle>{t("settings.api.createTitle")}</DialogTitle>
              <DialogDescription>{t("settings.api.createDescription")}</DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
              <FieldGroup>
                <Controller
                  name="name"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={field.name}>{t("settings.api.nameLabel")}</FieldLabel>
                      <Input
                        {...field}
                        id={field.name}
                        placeholder={t("settings.api.namePlaceholder")}
                        aria-invalid={fieldState.invalid}
                        disabled={isCreating}
                        autoComplete="off"
                      />
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
                <Controller
                  name="scopes"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <FieldSet data-invalid={fieldState.invalid}>
                      <FieldLegend variant="label">{t("settings.api.scopesLabel")}</FieldLegend>
                      <FieldDescription>{t("settings.api.scopesDescription")}</FieldDescription>
                      <FieldGroup className="gap-3">
                        {API_TOKEN_SCOPES.map((scope) => {
                          const inputId = `api-token-scope-${scope.replace(":", "-")}`

                          return (
                            <Field key={scope} orientation="horizontal">
                              <Checkbox
                                id={inputId}
                                checked={field.value.includes(scope)}
                                disabled={isCreating}
                                aria-invalid={fieldState.invalid}
                                onCheckedChange={(checked) =>
                                  field.onChange(
                                    checked === true
                                      ? [...field.value, scope]
                                      : field.value.filter((value) => value !== scope)
                                  )
                                }
                              />
                              <FieldLabel htmlFor={inputId} className="font-normal">
                                {t(apiTokenScopeLabelKeys[scope])}
                              </FieldLabel>
                            </Field>
                          )
                        })}
                      </FieldGroup>
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </FieldSet>
                  )}
                />
                <Controller
                  name="expiry"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={field.name}>{t("settings.api.expiryLabel")}</FieldLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={isCreating}
                      >
                        <SelectTrigger
                          ref={field.ref}
                          id={field.name}
                          className="w-full"
                          aria-invalid={fieldState.invalid}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {API_TOKEN_EXPIRY_OPTIONS.map((option) => (
                              <SelectItem key={option} value={option}>
                                {t(`settings.api.expiry.${option}`)}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
              </FieldGroup>
              {serverError && <FieldError>{serverError}</FieldError>}
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline" disabled={isCreating}>
                    {t("common.actions.cancel")}
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={submitDisabled}>
                  {isCreating && <Spinner />}
                  {t("settings.api.submitCreate")}
                </Button>
              </DialogFooter>
            </form>
          </Fragment>
        )}
      </DialogContent>
    </Dialog>
  )
}

export { CreateApiTokenDialog }
