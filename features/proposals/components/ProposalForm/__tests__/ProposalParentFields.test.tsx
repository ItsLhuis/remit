import { useForm } from "react-hook-form"

import { cleanup, render, screen } from "@testing-library/react"

import { afterEach, expect, test, vi } from "vitest"

import { type ProposalFormInputValues } from "../../../schemas"
import { ProposalParentFields } from "../ProposalParentFields"

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {},
    ready: true,
    locales: {}
  })
}))

type HarnessProps = {
  projectId?: string
  clientId?: string
  disabled?: boolean
}

const projects = [{ id: "11111111-1111-4111-8111-111111111111", name: "Website rebuild" }]
const clients = [{ id: "22222222-2222-4222-8222-222222222222", name: "Acme Studio" }]

const Harness = ({ projectId = "", clientId = "", disabled = false }: HarnessProps) => {
  const form = useForm<ProposalFormInputValues>({ defaultValues: { projectId, clientId } })

  return (
    <ProposalParentFields
      control={form.control}
      projects={projects}
      clients={clients}
      disabled={disabled}
    />
  )
}

afterEach(() => {
  cleanup()
})

test("labels both parent selects and offers each one an explicit no-parent choice", () => {
  render(<Harness />)

  const [project, client] = screen.getAllByRole("combobox")

  expect(screen.getByText("proposals.fields.project")).toBeInTheDocument()
  expect(screen.getByText("proposals.fields.client")).toBeInTheDocument()
  expect(project).toHaveTextContent("proposals.form.noProject")
  expect(client).toHaveTextContent("proposals.form.noClient")
})

test("shows the chosen project and client rather than each other's option list", () => {
  render(<Harness projectId={projects[0]?.id} clientId={clients[0]?.id} />)

  const [project, client] = screen.getAllByRole("combobox")

  expect(project).toHaveTextContent("Website rebuild")
  expect(client).toHaveTextContent("Acme Studio")
})

test("disables both selects while the form is submitting", () => {
  render(<Harness projectId={projects[0]?.id} disabled />)

  for (const trigger of screen.getAllByRole("combobox")) {
    expect(trigger).toBeDisabled()
  }
})
