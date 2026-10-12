import { expect, test } from "vitest"

import { decodeMappings, encodeMappings } from "../sourceMapCodec"

test("decodes every field to its absolute value, resetting only the column per line", () => {
  expect(decodeMappings("AAAA,SAAS,EAAS,GAChB;CAAC,IAAIA")).toEqual([
    [
      [0, 0, 0, 0],
      [9, 0, 0, 9],
      [11, 0, 0, 18],
      [14, 0, 1, 2]
    ],
    [
      [1, 0, 1, 3],
      [5, 0, 1, 7, 0]
    ]
  ])
})

test("encodes back to the same text it decoded, empty lines and large deltas included", () => {
  const mappings = "4ZAAA,IAAAA,EAAA;;GAAAC,EAAAD,EAAA,2BAAAE;AAAA"

  expect(encodeMappings(decodeMappings(mappings))).toBe(mappings)
})
