"use client"

import { FieldLabel, ToggleGroup, ToggleGroupItem } from "@/components/ui"

type FieldRowSegmentedProps = {
  label: string
  value: string | undefined
  options: { value: string; label: string }[]
  disabled?: boolean
  onChange: (value: string | undefined) => void
}

// A single-select segmented bar; re-selecting the active option clears it back to the inherited
// default, which is how optional style properties reset.
const FieldRowSegmented = ({
  label,
  value,
  options,
  disabled,
  onChange
}: FieldRowSegmentedProps) => {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel className="text-muted-foreground text-xs font-medium">{label}</FieldLabel>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={value ?? ""}
        disabled={disabled}
        onValueChange={(next) => onChange(next === "" ? undefined : next)}
        className="w-full"
      >
        {options.map((option) => (
          <ToggleGroupItem key={option.value} value={option.value} className="flex-1 text-xs">
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}

export { FieldRowSegmented }
