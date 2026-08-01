import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { PublicContractSignForm } from "../PublicContractSignForm"

const mocks = vi.hoisted(() => ({
  signContract: vi.fn()
}))

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {},
    ready: true,
    locales: {}
  })
}))

vi.mock("../publicContractClient", () => ({
  signContract: mocks.signContract
}))

// `../../schemas` reaches the templates barrel for `blocksSchema`, and that barrel pulls the
// templates mutations and their `@/lib/auth` import, which validates the environment at module load
// and exits the test process. Only the schema module is needed here, and the contract schemas under
// test stay real.
vi.mock("@/features/templates", async () => {
  const actual = await vi.importActual<typeof import("@/features/templates/schemas")>(
    "@/features/templates/schemas"
  )

  return { blocksSchema: actual.blocksSchema }
})

const consentText = "I agree to be bound by contract CTR-0007"

function renderForm(onSigned = vi.fn()) {
  render(
    <PublicContractSignForm token="token-value" consentText={consentText} onSigned={onSigned} />
  )

  return { onSigned }
}

async function fillIdentity(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("contracts.public.sign.nameLabel"), "Ada Lovelace")
  await user.type(screen.getByLabelText("contracts.public.sign.emailLabel"), "ada@northwind.test")
}

beforeEach(() => {
  vi.clearAllMocks()

  mocks.signContract.mockResolvedValue({
    data: { status: "signed", signedAt: "2026-08-01T10:00:00.000Z" }
  })
})

afterEach(() => {
  cleanup()
})

test("shows the exact consent statement the server will snapshot", () => {
  renderForm()

  expect(screen.getByText(consentText)).toBeInTheDocument()
})

test("keeps the submit button disabled until the consent box is checked", async () => {
  const user = userEvent.setup()

  renderForm()

  await fillIdentity(user)

  expect(screen.getByRole("button", { name: "contracts.public.sign.submit" })).toBeDisabled()
})

test("submits the signer identity and the accepted consent when the form is complete", async () => {
  const user = userEvent.setup()

  const { onSigned } = renderForm()

  await fillIdentity(user)
  await user.click(screen.getByRole("checkbox", { name: "contracts.public.sign.consentLabel" }))

  const submit = screen.getByRole("button", { name: "contracts.public.sign.submit" })

  await waitFor(() => expect(submit).toBeEnabled())
  await user.click(submit)

  await waitFor(() => {
    expect(mocks.signContract).toHaveBeenCalledWith("token-value", {
      signerName: "Ada Lovelace",
      signerEmail: "ada@northwind.test",
      consentAccepted: true
    })
  })
  expect(onSigned).toHaveBeenCalledWith(new Date("2026-08-01T10:00:00.000Z"))
})

test("surfaces the server message and stays on the form when signing is refused", async () => {
  const user = userEvent.setup()

  mocks.signContract.mockResolvedValue({ error: "This contract can no longer be signed" })

  const { onSigned } = renderForm()

  await fillIdentity(user)
  await user.click(screen.getByRole("checkbox", { name: "contracts.public.sign.consentLabel" }))

  const submit = screen.getByRole("button", { name: "contracts.public.sign.submit" })

  await waitFor(() => expect(submit).toBeEnabled())
  await user.click(submit)

  expect(await screen.findByText("This contract can no longer be signed")).toBeInTheDocument()
  expect(onSigned).not.toHaveBeenCalled()
})

test("reports an invalid email instead of calling the signing endpoint", async () => {
  const user = userEvent.setup()

  renderForm()

  await user.type(screen.getByLabelText("contracts.public.sign.nameLabel"), "Ada Lovelace")
  await user.type(screen.getByLabelText("contracts.public.sign.emailLabel"), "not-an-email")
  await user.click(screen.getByRole("checkbox", { name: "contracts.public.sign.consentLabel" }))
  await user.click(screen.getByRole("button", { name: "contracts.public.sign.submit" }))

  expect(mocks.signContract).not.toHaveBeenCalled()
})
