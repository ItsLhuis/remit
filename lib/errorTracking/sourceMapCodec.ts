const BASE64_DIGITS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

// One mapping segment with every field absolute: generated column, then source index, original
// line, original column and name index when the segment has them.
export type MappingSegment = number[]

// The source map v3 `mappings` encoding: lines separated by `;`, segments by `,`, each segment a
// run of base64 VLQ numbers. The generated column is relative to the previous segment on the same
// line, and every other field to the same field in the previous segment anywhere in the map.
//
// Decoded here rather than through `node:module`'s `SourceMap`, whose `findEntry` carries the last
// name it decoded forward onto every later segment that has none: a position in an identifier the
// minifier left alone would come back named after whatever was renamed before it. Both readers of a
// map in Remit go through this one: `scripts/core/build/serverSourceMaps.ts`, which writes the names,
// and `sourceMaps.ts`, which reads them.
export function decodeMappings(mappings: string): MappingSegment[][] {
  const previous = [0, 0, 0, 0, 0]

  return mappings.split(";").map((line) => {
    previous[0] = 0

    if (line === "") return []

    return line.split(",").map((text) =>
      decodeVlq(text).map((delta, field) => {
        const value = (previous[field] ?? 0) + delta

        previous[field] = value

        return value
      })
    )
  })
}

export function encodeMappings(lines: MappingSegment[][]): string {
  const previous = [0, 0, 0, 0, 0]

  return lines
    .map((segments) => {
      previous[0] = 0

      return segments
        .map((segment) =>
          segment
            .map((value, field) => {
              const delta = value - (previous[field] ?? 0)

              previous[field] = value

              return encodeVlq(delta)
            })
            .join("")
        )
        .join(",")
    })
    .join(";")
}

function decodeVlq(text: string): number[] {
  const values: number[] = []

  let value = 0
  let shift = 0

  for (const character of text) {
    const digit = BASE64_DIGITS.indexOf(character)

    value += (digit & 31) << shift

    if (digit & 32) {
      shift += 5
      continue
    }

    values.push(value & 1 ? -(value >>> 1) : value >>> 1)
    value = 0
    shift = 0
  }

  return values
}

function encodeVlq(value: number): string {
  let remaining = value < 0 ? (-value << 1) | 1 : value << 1
  let encoded = ""

  do {
    let digit = remaining & 31

    remaining >>>= 5

    if (remaining > 0) digit |= 32

    encoded += BASE64_DIGITS[digit]
  } while (remaining > 0)

  return encoded
}
