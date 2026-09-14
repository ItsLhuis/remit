"use client"

import { useEffect, useState, useTransition } from "react"

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
  Spinner,
  toast
} from "@/components/ui"

import { webhookEventGroups } from "../../labels"
import { createWebhookEndpoint } from "../../mutations"
import { createWebhookEndpointSchema, type CreateWebhookEndpointInputValues } from "../../schemas"
import { type WebhookEndpointListItem } from "../../types"

const emptyEndpointValues: CreateWebhookEndpointInputValues = {
  url: "",
  events: []
}

type CreateWebhookDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (endpoint: WebhookEndpointListItem, secret: string) => void
}

const CreateWebhookDialog = ({ open, onOpenChange, onCreated }: CreateWebhookDialogProps) => {
  const { t } = useTranslation()

  const [serverError, setServerError] = useState<string | null>(null)

  const [isCreating, startCreating] = useTransition()

  const form = useForm<CreateWebhookEndpointInputValues>({
    resolver: zodResolver(createWebhookEndpointSchema, {}, { raw: true }),
    mode: "onChange",
    defaultValues: emptyEndpointValues
  })

  const { isValid } = form.formState

  const submitDisabled = isCreating || !isValid

  const onSubmit = (values: CreateWebhookEndpointInputValues) => {
    if (submitDisabled) return

    setServerError(null)

    startCreating(async () => {
      const result = await createWebhookEndpoint(values)

      if ("error" in result) {
        setServerError(result.error)

        return
      }

      onCreated(result.data.endpoint, result.data.secret)

      toast.success(t("settings.webhooks.created"))
    })
  }

  useEffect(() => {
    if (open) form.reset(emptyEndpointValues)
  }, [open, form])

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (isCreating) return

        if (!nextOpen) setServerError(null)

        onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("settings.webhooks.createTitle")}</DialogTitle>
          <DialogDescription>{t("settings.webhooks.createDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
          <FieldGroup>
            <Controller
              name="url"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>{t("settings.webhooks.urlLabel")}</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    type="url"
                    inputMode="url"
                    placeholder={t("settings.webhooks.urlPlaceholder")}
                    aria-invalid={fieldState.invalid}
                    disabled={isCreating}
                    autoComplete="off"
                    className="font-mono text-xs"
                  />
                  <FieldDescription>{t("settings.webhooks.urlDescription")}</FieldDescription>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              name="events"
              control={form.control}
              render={({ field, fieldState }) => (
                <FieldSet data-invalid={fieldState.invalid}>
                  <FieldLegend variant="label">{t("settings.webhooks.eventsLabel")}</FieldLegend>
                  <FieldDescription>{t("settings.webhooks.eventsDescription")}</FieldDescription>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {webhookEventGroups.map((group) => (
                      <FieldGroup key={group.labelKey} className="gap-2">
                        <span className="text-muted-foreground text-xs font-medium">
                          {t(group.labelKey)}
                        </span>
                        {group.events.map((event) => {
                          const inputId = `webhook-event-${event.replaceAll(".", "-")}`

                          return (
                            <Field key={event} orientation="horizontal">
                              <Checkbox
                                id={inputId}
                                checked={field.value.includes(event)}
                                disabled={isCreating}
                                aria-invalid={fieldState.invalid}
                                onCheckedChange={(checked) =>
                                  field.onChange(
                                    checked === true
                                      ? [...field.value, event]
                                      : field.value.filter((value) => value !== event)
                                  )
                                }
                              />
                              <FieldLabel htmlFor={inputId} className="font-normal">
                                {t(`settings.webhooks.events.${event}`)}
                              </FieldLabel>
                            </Field>
                          )
                        })}
                      </FieldGroup>
                    ))}
                  </div>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </FieldSet>
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
              {t("settings.webhooks.submitCreate")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export { CreateWebhookDialog }
