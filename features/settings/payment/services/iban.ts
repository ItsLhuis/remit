export function normalizeIban(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase()
}

export function isValidIban(value: string): boolean {
  const iban = normalizeIban(value)

  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false

  // ISO 13616 mod-97 check: move the country code and check digits to the end, replace each letter
  // with its position + 9 (A = 10 … Z = 35), and read the result as one decimal integer, which is
  // valid exactly when it is congruent to 1 mod 97. The number is far too large for a JS number,
  // so the remainder is accumulated digit by digit instead of being computed in one step.
  const rearranged = `${iban.slice(4)}${iban.slice(0, 4)}`
  let remainder = 0

  for (const character of rearranged) {
    const numericValue = getIbanCharacterValue(character)

    if (numericValue === null) return false

    for (const digit of numericValue) {
      remainder = (remainder * 10 + Number(digit)) % 97
    }
  }

  return remainder === 1
}

export function maskIbanForDisplay(value: string): string | null {
  const iban = normalizeIban(value)

  if (!isValidIban(iban)) return null

  return `${iban.slice(0, 4)} ... ${iban.slice(-4)}`
}

function getIbanCharacterValue(character: string): string | null {
  if (/^\d$/.test(character)) return character

  const code = character.charCodeAt(0)

  if (code < 65 || code > 90) return null

  return String(code - 55)
}
