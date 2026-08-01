import i18n from "@/lib/i18n/i18n"

import { type ContractStatus, type SignContractValues } from "../../schemas"

// Module-private to this folder: the signing form is the only caller, and it needs the handling of
// a route that answers `{ error }` with one status on every failure and never throws. Failures come
// back as a message, so the form renders them in `FieldError` instead of branching on HTTP status —
// the status is deliberately uninformative (see `sign/route.ts`).

type PublicContractResult<TData> = { data: TData } | { error: string }

// `signedAt` crosses as an ISO string; the caller parses it back into a Date for display.
export type SignContractResponse = {
  status: ContractStatus
  signedAt: string
}

export async function signContract(
  token: string,
  body: SignContractValues
): Promise<PublicContractResult<SignContractResponse>> {
  let response: Response

  try {
    response = await fetch(`/c/${encodeURIComponent(token)}/sign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
  } catch {
    return { error: i18n.t("contracts.public.errors.requestFailed") }
  }

  if (!response.ok) return { error: await readErrorMessage(response) }

  const payload: unknown = await readJsonBody(response)

  return { data: payload as SignContractResponse }
}

// The failure body is already a translated `{ error }` from the route; anything else — an empty
// body, a proxy's HTML error page — falls back to the generic message rather than surfacing raw
// upstream text to the signer.
async function readErrorMessage(response: Response): Promise<string> {
  const payload = await readJsonBody(response)

  if (typeof payload === "object" && payload !== null && "error" in payload) {
    const message = (payload as { error: unknown }).error

    if (typeof message === "string") return message
  }

  return i18n.t("contracts.public.errors.requestFailed")
}

async function readJsonBody(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}
