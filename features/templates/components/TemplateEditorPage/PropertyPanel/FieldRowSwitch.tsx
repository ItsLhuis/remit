"use client"

import { FieldLabel, Switch } from "@/components/ui"

type FieldRowSwitchProps = {
  id: string
  label: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}

const FieldRowSwitch = ({ id, label, checked, disabled, onChange }: FieldRowSwitchProps) => {
  return (
    <div className="flex items-center justify-between gap-2">
      <FieldLabel htmlFor={id} className="text-muted-foreground text-xs font-medium">
        {label}
      </FieldLabel>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  )
}

export { FieldRowSwitch }
