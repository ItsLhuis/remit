import i18n from "@/lib/i18n/i18n"

import {
  type ProposalOtpRequestValues,
  type ProposalOtpVerifyValues,
  type ProposalStatus
} from "../../schemas"

// Module-private to this folder: the two response forms are the only callers, and both need the
// same handling of routes that answer `{ error }` with one status on every failure and never throw.
// Failures come back as a message, so a form renders them in `FieldError` instead of branching on
// HTTP status — the status is deliberately uninformative (see `otp/request/route.ts`).

type PublicProposalResult<TData> = { data: TData } | { error: string }

export function requestProposalCode(
  token: string,
  body: ProposalOtpRequestValues
): Promise<PublicProposalResult<{ expiresInMinutes: number }>> {
  return postPublicProposal(`/p/${encodeURIComponent(token)}/otp/request`, body)
}

export function verifyProposalCode(
  token: string,
  body: ProposalOtpVerifyValues
): Promise<PublicProposalResult<{ status: ProposalStatus }>> {
  return postPublicProposal(`/p/${encodeURIComponent(token)}/otp/verify`, body)
}

async function postPublicProposal<TData>(
  path: string,
  body: unknown
): Promise<PublicProposalResult<TData>> {
  let response: Response

  try {
    response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
  } catch {
    return { error: i18n.t("proposals.public.errors.requestFailed") }
  }

  if (!response.ok) return { error: await readErrorMessage(response) }

  const payload: unknown = await readJsonBody(response)

  return { data: payload as TData }
}

// The failure body is already a translated `{ error }` from the route; anything else — an empty
// body, a proxy's HTML error page — falls back to the generic message rather than surfacing raw
// upstream text to the client.
async function readErrorMessage(response: Response): Promise<string> {
  const payload = await readJsonBody(response)

  if (typeof payload === "object" && payload !== null && "error" in payload) {
    const message = (payload as { error: unknown }).error

    if (typeof message === "string") return message
  }

  return i18n.t("proposals.public.errors.requestFailed")
}

async function readJsonBody(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}
