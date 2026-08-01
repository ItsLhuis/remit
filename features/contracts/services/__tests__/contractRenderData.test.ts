import { expect, test } from "vitest"

import { buildContractRenderData, type ContractRenderDataInput } from "../contractRenderData"

function makeInput(overrides: Partial<ContractRenderDataInput> = {}): ContractRenderDataInput {
  return {
    contract: {
      number: "CTR-0007",
      title: "Retainer agreement",
      effectiveFrom: new Date("2026-08-01T00:00:00.000Z"),
      effectiveUntil: new Date("2027-07-31T00:00:00.000Z"),
      issuedAt: new Date("2026-07-15T09:30:00.000Z"),
      terminationReason: null
    },
    client: {
      name: "Northwind Ltd",
      email: "ops@northwind.test",
      phone: "+351 200 000 000",
      website: "https://northwind.test",
      taxId: "PT500000000",
      addressLine1: "Rua Um 1",
      addressLine2: null,
      city: "Porto",
      state: null,
      postalCode: "4000-000",
      country: "Portugal",
      currency: "EUR"
    },
    business: {
      name: "Studio Remit",
      email: "hello@remit.test",
      phone: null,
      website: null,
      taxId: null,
      addressLine1: null,
      addressLine2: null,
      city: null,
      state: null,
      postalCode: null,
      country: null
    },
    statusLabel: "Sent",
    locale: "en-US",
    ...overrides
  }
}

test("maps contract fields onto their merge variables", () => {
  const result = buildContractRenderData(makeInput())

  expect(result.values["contract.number"]).toBe("CTR-0007")
  expect(result.values["contract.title"]).toBe("Retainer agreement")
  expect(result.values["contract.status"]).toBe("Sent")
})

test("maps client and business fields onto their merge variables", () => {
  const result = buildContractRenderData(makeInput())

  expect(result.values["client.name"]).toBe("Northwind Ltd")
  expect(result.values["client.email"]).toBe("ops@northwind.test")
  expect(result.values["business.name"]).toBe("Studio Remit")
  expect(result.values["business.email"]).toBe("hello@remit.test")
})

test("formats every date variable with the supplied locale", () => {
  const result = buildContractRenderData(makeInput())

  expect(result.values["contract.effectiveFrom"]).toBe("Aug 1, 2026")
  expect(result.values["contract.effectiveUntil"]).toBe("Jul 31, 2027")
  expect(result.values["contract.issuedAt"]).toBe("Jul 15, 2026")
})

test("renders an absent optional value as an empty string rather than omitting its key", () => {
  const result = buildContractRenderData(makeInput())

  expect(result.values).toHaveProperty("client.state", "")
  expect(result.values).toHaveProperty("business.country", "")
  expect(result.values).toHaveProperty("contract.terminationReason", "")
})

test("renders every client variable as empty when the contract has no client", () => {
  const result = buildContractRenderData(makeInput({ client: null }))

  expect(result.values["client.name"]).toBe("")
  expect(result.values["client.email"]).toBe("")
  expect(result.values["client.currency"]).toBe("")
})

test("renders an absent date as an empty string", () => {
  const input = makeInput()

  const result = buildContractRenderData({
    ...input,
    contract: { ...input.contract, effectiveFrom: null, effectiveUntil: null, issuedAt: null }
  })

  expect(result.values["contract.effectiveFrom"]).toBe("")
  expect(result.values["contract.effectiveUntil"]).toBe("")
  expect(result.values["contract.issuedAt"]).toBe("")
})

test("covers every merge variable the contract template type allows", () => {
  const result = buildContractRenderData(makeInput())

  expect(Object.keys(result.values).toSorted()).toEqual(
    [
      "business.addressLine1",
      "business.addressLine2",
      "business.city",
      "business.country",
      "business.email",
      "business.name",
      "business.phone",
      "business.postalCode",
      "business.state",
      "business.taxId",
      "business.website",
      "client.addressLine1",
      "client.addressLine2",
      "client.city",
      "client.country",
      "client.currency",
      "client.email",
      "client.name",
      "client.phone",
      "client.postalCode",
      "client.state",
      "client.taxId",
      "client.website",
      "contract.effectiveFrom",
      "contract.effectiveUntil",
      "contract.issuedAt",
      "contract.number",
      "contract.status",
      "contract.terminationReason",
      "contract.title"
    ].toSorted()
  )
})
