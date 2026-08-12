"use client"

import { useEffect, useState, useTransition } from "react"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import {
  Button,
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
  Input,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  toast
} from "@/components/ui"

import { inviteTeamMember } from "../../mutations"
import {
  ASSIGNABLE_ROLES,
  inviteTeamMemberSchema,
  type InviteTeamMemberInputValues
} from "../../schemas"
import { type TeamInvitationListItem } from "../../types"

const emptyInviteValues: InviteTeamMemberInputValues = {
  email: "",
  role: "accountant"
}

type InviteMemberDialogProps = {
  open: boolean
  emailConfigured: boolean
  onOpenChange: (open: boolean) => void
  onInvited: (invitation: TeamInvitationListItem) => void
}

const InviteMemberDialog = ({
  open,
  emailConfigured,
  onOpenChange,
  onInvited
}: InviteMemberDialogProps) => {
  const { t } = useTranslation()

  const [serverError, setServerError] = useState<string | null>(null)

  const [isInviting, startInviting] = useTransition()

  // Resolved with `raw: true` so the control keeps the string the user typed while the schema's
  // trim/lowercase transform runs once on the server, where `inviteTeamMember` re-parses it.
  const form = useForm<InviteTeamMemberInputValues>({
    resolver: zodResolver(inviteTeamMemberSchema, {}, { raw: true }),
    mode: "onChange",
    defaultValues: emptyInviteValues
  })

  const { isValid } = form.formState

  useEffect(() => {
    if (open) form.reset(emptyInviteValues)
  }, [open, form])

  const submitDisabled = isInviting || !isValid

  const onSubmit = (values: InviteTeamMemberInputValues) => {
    if (submitDisabled) return

    setServerError(null)

    startInviting(async () => {
      const result = await inviteTeamMember(values)

      if ("error" in result) {
        setServerError(result.error)

        return
      }

      onInvited(result.data.invitation)

      toast.success(
        result.data.emailDelivered
          ? t("settings.team.inviteSent", { email: result.data.invitation.email })
          : t("settings.team.inviteCreated", { email: result.data.invitation.email })
      )
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (isInviting) return

        if (!nextOpen) setServerError(null)

        onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("settings.team.inviteTitle")}</DialogTitle>
          <DialogDescription>{t("settings.team.inviteDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
          <FieldGroup>
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
                    placeholder={t("settings.team.emailPlaceholder")}
                    aria-invalid={fieldState.invalid}
                    disabled={isInviting}
                    autoComplete="off"
                  />
                  <FieldDescription>
                    {emailConfigured
                      ? t("settings.team.emailWillSend")
                      : t("settings.team.emailWillNotSend")}
                  </FieldDescription>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              name="role"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>{t("settings.team.tableRole")}</FieldLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={isInviting}>
                    <SelectTrigger
                      ref={field.ref}
                      id={field.name}
                      className="w-full"
                      aria-invalid={fieldState.invalid}
                    >
                      <SelectValue placeholder={t("settings.team.selectRole")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {ASSIGNABLE_ROLES.map((role) => (
                          <SelectItem key={role} value={role}>
                            {t(`settings.team.roles.${role}`)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    {t(`settings.team.roleDescriptions.${field.value}`)}
                  </FieldDescription>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </FieldGroup>
          {serverError && <FieldError>{serverError}</FieldError>}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isInviting}>
                {t("common.actions.cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={submitDisabled}>
              {isInviting && <Spinner />}
              {t("settings.team.sendInvite")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export { InviteMemberDialog }
