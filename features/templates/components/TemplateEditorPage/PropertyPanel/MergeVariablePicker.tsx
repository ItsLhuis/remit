"use client"

import { useState } from "react"

import { useTranslation } from "@/lib/i18n"

import {
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Icon,
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui"

import { MERGE_VARIABLE_LABEL_KEYS } from "../../../labels"
import { type TemplateType } from "../../../schemas"
import { getMergeVariables } from "../../../services"

type MergeVariablePickerProps = {
  type: TemplateType
  disabled?: boolean
  onInsert: (identifier: string) => void
}

// The only merge-variable surface in the editor: human-readable labels in a searchable list, the
// raw {{token}} inserted at the caller's cursor. Raw identifiers never appear as labels here or
// anywhere else outside the text block's stored content itself.
const MergeVariablePicker = ({ type, disabled, onInsert }: MergeVariablePickerProps) => {
  const { t } = useTranslation()

  const [open, setOpen] = useState(false)

  const variables = getMergeVariables(type)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={disabled}>
          <Icon name="Braces" aria-hidden="true" />
          {t("templates.mergeVariables.insertVariable")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder={t("templates.mergeVariables.searchPlaceholder")} />
          <CommandList>
            <CommandEmpty>{t("templates.mergeVariables.noResults")}</CommandEmpty>
            <CommandGroup heading={t("templates.mergeVariables.title")}>
              {variables.map((identifier) => (
                <CommandItem
                  key={identifier}
                  value={t(MERGE_VARIABLE_LABEL_KEYS[identifier])}
                  onSelect={() => {
                    onInsert(identifier)
                    setOpen(false)
                  }}
                >
                  {t(MERGE_VARIABLE_LABEL_KEYS[identifier])}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export { MergeVariablePicker }
