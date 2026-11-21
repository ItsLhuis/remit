import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { PublicProposalIdentityForm } from "../PublicProposalIdentityForm"

const mocks = vi.hoisted(() => ({
  requestProposalCode: vi.fn()
}))

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {},
    ready: true,
    locales: {}
  })
}))

vi.mock("../publicProposalClient", () => ({
  requestProposalCode: mocks.requestProposalCode
}))

beforeEach(() => {
  vi.clearAllMocks()

  mocks.requestProposalCode.mockResolvedValue({ data: { expiresInMinutes: 10 } })
})

afterEach(() => {
  cleanup()
})

test("requests a code when the client types an address and clicks straight through", async () => {
  const user = userEvent.setup()
  const onSent = vi.fn()

  render(
    <PublicProposalIdentityForm
      action="accept"
      token="token-value"
      onSent={onSent}
      onBack={vi.fn()}
    />
  )

  await user.type(
    screen.getByLabelText("proposals.public.identity.emailLabel"),
    "ada@northwind.test"
  )
  await user.click(screen.getByRole("button", { name: "proposals.public.identity.submit" }))

  await waitFor(() => {
    expect(mocks.requestProposalCode).toHaveBeenCalledWith("token-value", {
      action: "accept",
      email: "ada@northwind.test"
    })
  })
  expect(onSent).toHaveBeenCalledTimes(1)
})

test("shows the validation message instead of requesting a code for an invalid address", async () => {
  const user = userEvent.setup()

  render(
    <PublicProposalIdentityForm
      action="accept"
      token="token-value"
      onSent={vi.fn()}
      onBack={vi.fn()}
    />
  )

  await user.type(screen.getByLabelText("proposals.public.identity.emailLabel"), "not-an-email")
  await user.click(screen.getByRole("button", { name: "proposals.public.identity.submit" }))

  expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument()
  expect(mocks.requestProposalCode).not.toHaveBeenCalled()
})
