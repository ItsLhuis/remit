// Radix's Select rejects an empty-string item value, but "no project", "no template" and "no tax
// rate" are real choices the form stores as "". This sentinel is the on-screen stand-in;
// `toSelectValue` and `fromSelectValue` are the only places the two representations meet, so the
// schemas keep seeing "" and never learn about it.
export const NO_SELECTION = "__none__"

export function toSelectValue(value: string): string {
  return value === "" ? NO_SELECTION : value
}

export function fromSelectValue(value: string): string {
  return value === NO_SELECTION ? "" : value
}
