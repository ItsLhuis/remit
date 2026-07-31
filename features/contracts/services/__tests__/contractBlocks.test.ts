import { expect, test } from "vitest"

import { makeTextBlock } from "@/tests/factories/blocks"

import { buildContractBlocksFromProposal, hasContractContent } from "../contractBlocks"

test("reports no content for an empty snapshot", () => {
  expect(hasContractContent([])).toBe(false)
})

test("reports no content when every block is hidden", () => {
  expect(hasContractContent([makeTextBlock({ hidden: true })])).toBe(false)
})

test("reports content for a visible block", () => {
  expect(hasContractContent([makeTextBlock()])).toBe(true)
})

test("copies the contract template blocks when one is supplied", () => {
  const templateBlocks = [makeTextBlock()]

  const result = buildContractBlocksFromProposal({ templateBlocks, proposalBlocks: [] })

  expect(result).toEqual(templateBlocks)
})

test("falls back to the proposal's own snapshot when no contract template exists", () => {
  const proposalBlocks = [makeTextBlock()]

  const result = buildContractBlocksFromProposal({ templateBlocks: null, proposalBlocks })

  expect(result).toEqual(proposalBlocks)
})

test("falls back to the proposal snapshot when the contract template has no visible block", () => {
  const proposalBlocks = [makeTextBlock()]

  const result = buildContractBlocksFromProposal({
    templateBlocks: [makeTextBlock({ hidden: true })],
    proposalBlocks
  })

  expect(result).toEqual(proposalBlocks)
})

test("returns an empty snapshot when neither source has content", () => {
  expect(buildContractBlocksFromProposal({ templateBlocks: null, proposalBlocks: [] })).toEqual([])
})
