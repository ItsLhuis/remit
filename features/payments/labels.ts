import { type PaymentMethod } from "./schemas"

type MethodPresentation = {
  variant: "secondary" | "info"
  icon: "Landmark" | "CreditCard" | "Banknote" | "Wallet"
}

// `stripe` is the only method carrying a distinct variant: it is the one nobody keyed by hand, so a
// reader scanning the list can tell provider-confirmed money from a manual bookkeeping entry.
export const paymentMethodPresentation: Record<PaymentMethod, MethodPresentation> = {
  bank_transfer: { variant: "secondary", icon: "Landmark" },
  stripe: { variant: "info", icon: "CreditCard" },
  cash: { variant: "secondary", icon: "Banknote" },
  other: { variant: "secondary", icon: "Wallet" }
}
