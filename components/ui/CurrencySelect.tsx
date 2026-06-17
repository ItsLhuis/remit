"use client"

import { type Ref, useCallback, useMemo } from "react"

import { currencies as AllCurrencies } from "country-data-list"

import { useTranslation } from "@/lib/i18n"

import { cn } from "@/lib/utils"

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/Select"

type Currency = {
  code: string
  decimals: number
  name: string
  number: string
  symbol?: string
}

const EXCLUDED_CURRENCIES = new Set([
  "AXG",
  "BAM",
  "BMD",
  "BOV",
  "CHE",
  "CHW",
  "CLF",
  "COU",
  "CUC",
  "KID",
  "KPW",
  "LAK",
  "MGA",
  "MRO",
  "MXV",
  "OMR",
  "PRB",
  "SSP",
  "STD",
  "SVC",
  "TJS",
  "TMT",
  "TVD",
  "USN",
  "UYI",
  "VED",
  "VES",
  "VND",
  "XAF",
  "XAG",
  "XAU",
  "XBA",
  "XBB",
  "XBC",
  "XBD",
  "XDR",
  "XOF",
  "XPD",
  "XPF",
  "XPT",
  "XSU",
  "XTS",
  "XUA",
  "XUG",
  "XXX",
  "ZWL"
])

const CUSTOM_CURRENCIES = new Set(["DKK", "SEK", "NOK", "EUR", "USD", "CAD", "GBP", "AUD", "NZD"])

type CurrencySelectProps = {
  ref?: Ref<HTMLButtonElement>
  id?: string
  value?: string
  onValueChangeAction?: (value: string) => void
  onCurrencySelectAction?: (currency: Currency) => void
  name?: string
  placeholder?: string
  currencies?: "custom" | "all"
  variant?: "default" | "small"
  valid?: boolean
  disabled?: boolean
  clearable?: boolean
}

const CurrencySelect = ({
  ref,
  id,
  value,
  onValueChangeAction,
  onCurrencySelectAction,
  name,
  placeholder,
  currencies = "all",
  variant = "default",
  valid = true,
  disabled,
  clearable = false
}: CurrencySelectProps) => {
  const { t } = useTranslation()

  const resolvedPlaceholder = placeholder ?? t("common.fields.selectCurrency")

  const uniqueCurrencies = useMemo<Currency[]>(() => {
    const currencyMap = new Map<string, Currency>()

    AllCurrencies.all.forEach((currency: Currency) => {
      if (!currency.code || !currency.name || !currency.symbol) return

      const shouldInclude =
        currencies === "custom"
          ? CUSTOM_CURRENCIES.has(currency.code)
          : !EXCLUDED_CURRENCIES.has(currency.code)

      if (!shouldInclude) return

      currencyMap.set(currency.code, {
        code: currency.code,
        name: currency.code === "EUR" ? "Euro" : currency.name,
        symbol: currency.symbol,
        decimals: currency.decimals,
        number: currency.number
      })
    })

    return Array.from(currencyMap.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [currencies])

  const handleValueChange = useCallback(
    (newValue: string) => {
      const fullCurrencyData = uniqueCurrencies.find((curr) => curr.code === newValue)

      if (!fullCurrencyData) return

      onValueChangeAction?.(newValue)
      onCurrencySelectAction?.(fullCurrencyData)
    },
    [uniqueCurrencies, onValueChangeAction, onCurrencySelectAction]
  )

  const handleClear = useCallback(() => onValueChangeAction?.(""), [onValueChangeAction])

  return (
    <Select
      data-slot="currency-select"
      value={value}
      onValueChange={handleValueChange}
      name={name}
      disabled={disabled}
    >
      <SelectTrigger
        ref={ref}
        id={id}
        className={cn("w-full", variant === "small" && "w-fit gap-2")}
        data-valid={valid}
        aria-invalid={!valid}
        clearable={clearable}
        onClear={handleClear}
      >
        {value && variant === "small" ? (
          <SelectValue placeholder={resolvedPlaceholder}>
            <span>{value}</span>
          </SelectValue>
        ) : (
          <SelectValue placeholder={resolvedPlaceholder} />
        )}
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {uniqueCurrencies.map((currency) => (
            <SelectItem key={currency.code} value={currency.code}>
              <div className="flex w-full items-center gap-2">
                <span className="text-muted-foreground w-8 text-left text-sm">{currency.code}</span>
                <span>{currency.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

export { CurrencySelect }
