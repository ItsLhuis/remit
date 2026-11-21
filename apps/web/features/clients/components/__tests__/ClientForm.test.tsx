import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { ClientForm } from "../ClientForm"

type CountrySelectProps = {
  disabled?: boolean
  id?: string
  onChangeAction?: (country: { alpha2: string }) => void
  valid?: boolean
  value?: string
}

type CurrencySelectProps = {
  disabled?: boolean
  id?: string
  onValueChangeAction?: (value: string) => void
  valid?: boolean
  value?: string
}

type PhoneInputProps = {
  disabled?: boolean
  id?: string
  onBlur?: () => void
  onValueChangeAction?: (value: string) => void
  placeholder?: string
  valid?: boolean
  value?: string
}

const mocks = vi.hoisted(() => ({
  back: vi.fn(),
  createClient: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
  updateClient: vi.fn()
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    back: mocks.back,
    push: mocks.push,
    refresh: mocks.refresh
  })
}))

vi.mock("../../mutations", () => ({
  createClient: mocks.createClient,
  updateClient: mocks.updateClient
}))

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {},
    ready: true,
    locales: {}
  })
}))

vi.mock("@/components/ui", async () => {
  const actual = await vi.importActual<typeof import("@/components/ui")>("@/components/ui")

  return {
    ...actual,
    CountrySelect: ({ disabled, id, onChangeAction, valid = true, value }: CountrySelectProps) => (
      <select
        id={id}
        value={value ?? ""}
        disabled={disabled}
        aria-invalid={!valid}
        onChange={(event) => onChangeAction?.({ alpha2: event.target.value })}
      >
        <option value="">Select country</option>
        <option value="US">United States</option>
      </select>
    ),
    CurrencySelect: ({
      disabled,
      id,
      onValueChangeAction,
      valid = true,
      value
    }: CurrencySelectProps) => (
      <select
        id={id}
        value={value ?? ""}
        disabled={disabled}
        aria-invalid={!valid}
        onChange={(event) => onValueChangeAction?.(event.target.value)}
      >
        <option value="EUR">EUR</option>
        <option value="USD">USD</option>
      </select>
    ),
    PhoneInput: ({
      disabled,
      id,
      onBlur,
      onValueChangeAction,
      placeholder,
      valid = true,
      value
    }: PhoneInputProps) => (
      <input
        id={id}
        value={value ?? ""}
        disabled={disabled}
        placeholder={placeholder}
        aria-invalid={!valid}
        onBlur={onBlur}
        onChange={(event) => onValueChangeAction?.(event.target.value)}
      />
    ),
    toast: {
      success: mocks.toastSuccess
    }
  }
})

async function fillRequiredClientFields(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.type(screen.getByLabelText("clients.fields.name"), "Acme Studio")
  await user.type(screen.getByLabelText("clients.fields.email"), "billing@example.com")
}

describe("ClientForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createClient.mockResolvedValue({
      data: {
        client: {
          id: "00000000-0000-4000-8000-000000000501",
          name: "Acme Studio",
          email: "billing@example.com"
        }
      }
    })
  })

  afterEach(() => {
    cleanup()
  })

  test("submits a new client when required fields are valid", async () => {
    const user = userEvent.setup()

    render(<ClientForm mode="create" defaultCurrency="EUR" />)

    await fillRequiredClientFields(user)
    await user.type(screen.getByLabelText("clients.fields.notes"), "Private note")

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /clients.form.saveCreate/ })).toBeEnabled()
    })

    await user.click(screen.getByRole("button", { name: /clients.form.saveCreate/ }))

    await waitFor(() => {
      expect(mocks.createClient).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Acme Studio",
          email: "billing@example.com",
          currency: "EUR",
          notes: "Private note"
        })
      )
    })
    expect(mocks.push).toHaveBeenCalledWith("/clients/00000000-0000-4000-8000-000000000501")
    expect(mocks.toastSuccess).toHaveBeenCalledWith("clients.form.created")
  })

  test("shows the server error when create fails", async () => {
    const user = userEvent.setup()

    mocks.createClient.mockResolvedValueOnce({ error: "Failed to update client" })

    render(<ClientForm mode="create" defaultCurrency="EUR" />)

    await fillRequiredClientFields(user)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /clients.form.saveCreate/ })).toBeEnabled()
    })

    await user.click(screen.getByRole("button", { name: /clients.form.saveCreate/ }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to update client")
  })
})
