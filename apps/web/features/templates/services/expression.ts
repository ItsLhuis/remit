// Numeric property-panel fields accept a plain number or a small arithmetic expression: +, -, *, /
// with standard precedence and no parentheses. A leading "+" or "-" is relative to the field's
// current value; everything else is absolute. Malformed input returns null so the caller reverts
// rather than committing NaN. No eval/Function - a real tokenizer and parser.

type Token = { type: "number"; value: number } | { type: "operator"; value: "+" | "-" | "*" | "/" }

const TOKEN_PATTERN = /\s*(\d+(?:\.\d+)?|[+\-*/])\s*/y

function tokenize(source: string): Token[] | null {
  const tokens: Token[] = []
  let position = 0

  while (position < source.length) {
    TOKEN_PATTERN.lastIndex = position

    const match = TOKEN_PATTERN.exec(source)

    if (!match) return null

    const raw = match[1]

    if (raw === "+" || raw === "-" || raw === "*" || raw === "/") {
      tokens.push({ type: "operator", value: raw })
    } else if (raw !== undefined) {
      tokens.push({ type: "number", value: Number(raw) })
    } else {
      return null
    }

    position += match[0].length
  }

  return tokens
}

// Recursive-descent parser over the token list:
//   sum    := term (("+" | "-") term)*
//   term   := factor (("*" | "/") factor)*
//   factor := ["+" | "-"] number
// Returns null for any malformed sequence (empty input, trailing operator, division by zero, a
// dangling token the grammar can't consume) rather than throwing.
function parseTokens(tokens: Token[]): number | null {
  let index = 0

  function parseFactor(): number | null {
    const token = tokens[index]

    if (!token) return null

    if (token.type === "operator" && (token.value === "+" || token.value === "-")) {
      index += 1

      const value = parseFactor()

      if (value === null) return null

      return token.value === "-" ? -value : value
    }

    if (token.type === "number") {
      index += 1

      return token.value
    }

    return null
  }

  function parseTerm(): number | null {
    let value = parseFactor()

    if (value === null) return null

    while (true) {
      const token = tokens[index]

      if (token?.type !== "operator" || (token.value !== "*" && token.value !== "/")) break

      index += 1

      const rhs = parseFactor()

      if (rhs === null) return null
      if (token.value === "/" && rhs === 0) return null

      value = token.value === "*" ? value * rhs : value / rhs
    }

    return value
  }

  function parseSum(): number | null {
    let value = parseTerm()

    if (value === null) return null

    while (true) {
      const token = tokens[index]

      if (token?.type !== "operator" || (token.value !== "+" && token.value !== "-")) break

      index += 1

      const rhs = parseTerm()

      if (rhs === null) return null

      value = token.value === "+" ? value + rhs : value - rhs
    }

    return value
  }

  const result = parseSum()

  return index === tokens.length ? result : null
}

function evaluateExpression(source: string): number | null {
  const tokens = tokenize(source)

  if (!tokens || tokens.length === 0) return null

  const result = parseTokens(tokens)

  return result !== null && Number.isFinite(result) ? result : null
}

// The current value is prepended before parsing, so precedence still applies to the rest: "+10*2"
// is current + 10*2, never (current + 10) * 2. Rejected with no current value to be relative to.
export function evaluateFieldExpression(raw: string, current: number | null): number | null {
  const trimmed = raw.trim()

  if (trimmed === "") return null

  if (trimmed.startsWith("+") || trimmed.startsWith("-")) {
    if (current === null) return null

    return evaluateExpression(`${current}${trimmed}`)
  }

  return evaluateExpression(trimmed)
}
