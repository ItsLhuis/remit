"use client"

import {
  FieldLabel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui"

type FieldRowSelectProps = {
  id: string
  label: string
  value: string
  options: { value: string; label: string }[]
  disabled?: boolean
  onChange: (value: string) => void
}

const FieldRowSelect = ({ id, label, value, options, disabled, onChange }: FieldRowSelectProps) => {
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-2">
      <FieldLabel htmlFor={id} className="text-muted-foreground text-xs font-medium">
        {label}
      </FieldLabel>
      <Select value={value} disabled={disabled} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export { FieldRowSelect }
