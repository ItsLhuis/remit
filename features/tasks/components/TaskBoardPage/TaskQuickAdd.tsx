"use client"

import { useEffect, useRef, useState } from "react"

import { useTranslation } from "@/lib/i18n"

import { Button, Icon, IconButton, Input, Spinner } from "@/components/ui"

type TaskQuickAddProps = {
  onCreate: (title: string) => Promise<boolean>
}

const TaskQuickAdd = ({ onCreate }: TaskQuickAddProps) => {
  const { t } = useTranslation()

  const [open, setOpen] = useState(false)
  const [value, setValue] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const close = () => {
    setOpen(false)
    setValue("")
  }

  const submit = async () => {
    const title = value.trim()

    if (title === "" || isSubmitting) return

    setIsSubmitting(true)

    const created = await onCreate(title)

    setIsSubmitting(false)

    if (created) setValue("")
  }

  if (!open) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="text-muted-foreground w-full justify-start"
      >
        <Icon name="Plus" aria-hidden="true" />
        {t("tasks.quickAdd.button")}
      </Button>
    )
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()

        void submit()
      }}
      className="flex items-center gap-1.5"
    >
      <Input
        ref={inputRef}
        value={value}
        disabled={isSubmitting}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault()

            close()
          }
        }}
        onBlur={() => {
          if (value.trim() === "" && !isSubmitting) close()
        }}
        placeholder={t("tasks.quickAdd.placeholder")}
        aria-label={t("tasks.quickAdd.placeholder")}
        autoComplete="off"
        className="flex-1"
      />
      <IconButton
        type="submit"
        size="icon-sm"
        variant="default"
        label={t("tasks.quickAdd.submit")}
        disabled={isSubmitting || value.trim() === ""}
      >
        {isSubmitting ? <Spinner /> : <Icon name="Plus" />}
      </IconButton>
    </form>
  )
}

export { TaskQuickAdd }
