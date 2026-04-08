"use client"

import { type Ref } from "react"

import { cn } from "@/lib/utils"

import { CircleFlag } from "react-circle-flags"

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/Select"

import { countries } from "country-data-list"

type Country = {
  alpha2: string
  alpha3: string
  countryCallingCodes: string[]
  currencies: string[]
  emoji?: string
  ioc: string
  languages: string[]
  name: string
  status: string
}

type CountrySelectProps = {
  ref?: Ref<HTMLButtonElement>
  id?: string
  options?: Country[]
  onChangeAction?: (country: Country) => void
  value?: string
  disabled?: boolean
  placeholder?: string
  slim?: boolean
  valid?: boolean
}

const CountrySelect = ({
  options = countries.all.filter(
    (country: Country) => country.emoji && country.status !== "deleted" && country.ioc !== "PRK"
  ),
  id,
  onChangeAction,
  value,
  disabled = false,
  placeholder = "Select a country",
  slim = false,
  valid = true,
  ref
}: CountrySelectProps) => {
  const handleValueChange = (alpha2: string) => {
    const country = options.find((c) => c.alpha2 === alpha2)

    if (!country) return

    onChangeAction?.(country)
  }

  const currentCountry = options.find((c) => c.alpha2 === value)

  return (
    <Select
      data-slot="country-select"
      value={value ?? ""}
      onValueChange={handleValueChange}
      disabled={disabled}
    >
      <SelectTrigger
        ref={ref}
        id={id}
        className={cn("w-full", slim && "w-fit gap-2")}
        data-valid={valid}
        aria-invalid={!valid}
      >
        {currentCountry && slim ? (
          <SelectValue placeholder={placeholder}>
            <span>{currentCountry.alpha2}</span>
          </SelectValue>
        ) : (
          <SelectValue placeholder={placeholder} />
        )}
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options
            .filter((x) => x.name && x.alpha3)
            .map((option) => (
              <SelectItem key={option.alpha2} value={option.alpha2}>
                <div className="flex w-full items-center gap-2">
                  <div className="inline-flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full">
                    <CircleFlag countryCode={option.alpha2.toLowerCase()} height={20} />
                  </div>
                  <span>{option.name}</span>
                </div>
              </SelectItem>
            ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

export { CountrySelect }
