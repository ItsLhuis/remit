"use client"

import { usePathname } from "next/navigation"

// The public token of the invoice the client is currently looking at, read back off the address bar
// rather than passed down from the server.
//
// The direction is deliberate. `app/(public)/i/[token]/page.tsx` renders a read model that carries
// neither the invoice's id nor its token, and `publicInvoiceRoute.test.tsx` pins that: the bearer
// credential never travels into the page's own markup. Reading it here adds no exposure, because the
// browser is already displaying it, and it keeps the server free to go on rendering a model with no
// credential in it.
//
// Both `/i/<token>` and `/i/<token>/paid` put the token in the same segment, so one split serves the
// invoice page and its payment return.
export function usePublicInvoiceToken(): string {
  const pathname = usePathname()

  const [, , token] = pathname.split("/")

  return token ?? ""
}
