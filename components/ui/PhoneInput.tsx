"use client"

import { type ComponentProps, memo, type Ref, useCallback } from "react"

import { cn } from "@/lib/utils"

import { useTranslation } from "@/lib/i18n"

import * as RPNInput from "react-phone-number-input"

import { CircleFlag } from "react-circle-flags"

import { Input } from "@/components/ui/Input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/Select"

type PhoneInputProps = Omit<ComponentProps<"input">, "onChange" | "value"> & {
  ref?: Ref<HTMLInputElement>
  value?: string
  onValueChangeAction?: (value: string) => void
  defaultCountry?: RPNInput.Country
  valid?: boolean
}

type CountrySelectProps = {
  value: RPNInput.Country | undefined
  onChange: (value: RPNInput.Country) => void
  options: { value: RPNInput.Country | undefined; label: string }[]
  disabled?: boolean
  valid?: boolean
}

const PhoneInput = ({
  ref,
  className,
  value,
  onValueChangeAction,
  defaultCountry = "US",
  valid = true,
  disabled = false,
  ...props
}: PhoneInputProps) => {
  const handleChange = useCallback(
    (val: RPNInput.Value | undefined) => onValueChangeAction?.(val ?? ""),
    [onValueChangeAction]
  )

  const countrySelectComponent = useCallback(
    (selectProps: CountrySelectProps) => <CountrySelect {...selectProps} valid={valid} />,
    [valid]
  )

  return (
    <RPNInput.default
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={ref as any}
      data-slot="phone-input"
      className={cn("flex w-full", className)}
      flagComponent={FlagCircle}
      countrySelectComponent={countrySelectComponent}
      inputComponent={InputComponent}
      smartCaret={false}
      defaultCountry={defaultCountry}
      value={(value || undefined) as RPNInput.Value | undefined}
      onChange={handleChange}
      disabled={disabled}
      {...(props as object)}
    />
  )
}

const InputComponent = memo(({ className, ...props }: ComponentProps<"input">) => (
  <Input
    data-slot="phone-input-field"
    className={cn("rounded-s-none rounded-e-lg", className)}
    {...props}
  />
))

InputComponent.displayName = "InputComponent"

const CountrySelect = memo(
  ({ value, onChange, options, disabled, valid = true }: CountrySelectProps) => {
    const { t } = useTranslation()

    return (
      <Select
        value={value ?? ""}
        onValueChange={(val) => onChange(val as RPNInput.Country)}
        disabled={disabled}
      >
        <SelectTrigger
          data-slot="phone-input-country-select"
          aria-label={t("common.fields.selectCountry")}
          className="w-fit rounded-e-none border-r-0 px-2.5 focus:z-10"
          data-valid={valid}
          aria-invalid={!valid}
        >
          <SelectValue placeholder={t("common.fields.selectCountry")}>
            {value ? (
              <span className="flex items-center gap-1.5">
                <FlagCircle country={value} countryName="" />
                <span className="text-muted-foreground">
                  +{RPNInput.getCountryCallingCode(value)}
                </span>
              </span>
            ) : null}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options
              .filter((opt) => opt.value)
              .map((opt) => (
                <SelectItem key={opt.value} value={opt.value!}>
                  <div className="flex w-full items-center gap-2">
                    <FlagCircle country={opt.value!} countryName={opt.label} />
                    <span>{opt.label}</span>
                    <span className="text-muted-foreground ml-auto text-sm">
                      +{RPNInput.getCountryCallingCode(opt.value!)}
                    </span>
                  </div>
                </SelectItem>
              ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    )
  }
)

CountrySelect.displayName = "CountrySelect"

const FlagCircle = ({ country }: RPNInput.FlagProps): React.ReactElement => (
  <div className="inline-flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full">
    <CircleFlag countryCode={country.toLowerCase()} height={20} />
  </div>
)

export { PhoneInput }
