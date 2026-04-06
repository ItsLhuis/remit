"use client"

import { type Ref, useMemo, useState } from "react"

import { cn } from "@/lib/utils"

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/Select"

import { currencies as AllCurrencies } from "country-data-list"

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
  value?: string
  onValueChangeAction?: (value: string) => void
  onCurrencySelectAction?: (currency: Currency) => void
  name?: string
  placeholder?: string
  currencies?: "custom" | "all"
  variant?: "default" | "small"
  valid?: boolean
  disabled?: boolean
}

const CurrencySelect = ({
  ref,
  value,
  onValueChangeAction,
  onCurrencySelectAction,
  name,
  placeholder = "Select currency",
  currencies = "all",
  variant = "default",
  valid = true,
  disabled,
  ...props
}: CurrencySelectProps) => {
  const [selectedCurrency, setSelectedCurrency] = useState<Currency | null>(null)

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

  const handleValueChange = (newValue: string) => {
    const fullCurrencyData = uniqueCurrencies.find((curr) => curr.code === newValue)

    if (!fullCurrencyData) return

    setSelectedCurrency(fullCurrencyData)
    onValueChangeAction?.(newValue)
    onCurrencySelectAction?.(fullCurrencyData)
  }

  void selectedCurrency

  return (
    <Select
      data-slot="currency-select"
      value={value}
      onValueChange={handleValueChange}
      name={name}
      disabled={disabled}
      {...props}
    >
      <SelectTrigger
        ref={ref}
        className={cn("w-full", variant === "small" && "w-fit gap-2")}
        data-valid={valid}
        aria-invalid={!valid}
      >
        {value && variant === "small" ? (
          <SelectValue placeholder={placeholder}>
            <span>{value}</span>
          </SelectValue>
        ) : (
          <SelectValue placeholder={placeholder} />
        )}
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {uniqueCurrencies.map((currency) => (
            <SelectItem key={currency.code} value={currency.code}>
              <div className="flex w-full items-center gap-2">
                <span className="w-8 text-left text-sm text-muted-foreground">{currency.code}</span>
                <span className="hidden">{currency.symbol}</span>
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
