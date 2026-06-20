const JSX_PARENT_TYPES = new Set([
  "JSXElement",
  "JSXFragment",
  "JSXExpressionContainer",
  "JSXAttribute",
  "JSXSpreadAttribute"
])

const SKIP_WALK_KEYS = new Set(["parent", "loc", "range", "comments", "tokens"])

const NESTED_FUNCTION_TYPES = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression"
])

// Database root identifiers whose awaited use counts as IO for `validate-before-io`. Kept narrow to
// the persistence boundary so the rule does not fire on incidental awaits.
const IO_ROOT_IDENTIFIERS = new Set(["database"])

function collectIdentifierNames(node, names = new Set()) {
  if (!node || typeof node.type !== "string") return names

  if (node.type === "Identifier" || node.type === "JSXIdentifier") names.add(node.name)

  for (const key of Object.keys(node)) {
    if (SKIP_WALK_KEYS.has(key)) continue

    const value = node[key]

    if (Array.isArray(value)) {
      for (const child of value) {
        if (child && typeof child.type === "string") collectIdentifierNames(child, names)
      }
    } else if (value && typeof value.type === "string") {
      collectIdentifierNames(value, names)
    }
  }

  return names
}

function hasIdentifierOverlap(nodeA, nodeB) {
  const namesA = collectIdentifierNames(nodeA)
  const namesB = collectIdentifierNames(nodeB)

  for (const name of namesA) {
    if (namesB.has(name)) return true
  }

  return false
}

const helperPlacement = {
  meta: {
    type: "problem",
    docs: {
      description:
        "File-private `function` helpers must be declared above the component, not after the last export"
    },
    messages: {
      helperAfterExport:
        "File-private `function` helper `{{name}}` is declared after the last export. Move it above the component (see components.md)."
    },
    schema: []
  },
  create(context) {
    const filename = context.filename ?? context.getFilename()

    if (!filename.endsWith(".tsx")) return {}

    return {
      "Program:exit"(program) {
        let lastExportStart = -1

        for (const node of program.body) {
          if (
            node.type === "ExportNamedDeclaration" ||
            node.type === "ExportDefaultDeclaration" ||
            node.type === "ExportAllDeclaration"
          ) {
            if (node.range[0] > lastExportStart) lastExportStart = node.range[0]
          }
        }

        if (lastExportStart === -1) return

        for (const node of program.body) {
          if (node.type === "FunctionDeclaration" && node.range[0] > lastExportStart) {
            context.report({
              node,
              messageId: "helperAfterExport",
              data: { name: node.id?.name ?? "anonymous" }
            })
          }
        }
      }
    }
  }
}

const noBlankLinesInJsxReturn = {
  meta: {
    type: "layout",
    docs: {
      description: "A JSX return tree contains no blank lines"
    },
    fixable: "whitespace",
    messages: {
      blankLine:
        "No blank lines inside a JSX tree. Separate sections by extracting a sub-component, not blank lines (see code-style.md)."
    },
    schema: []
  },
  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode()
    const reported = new Set()

    function isOutermostJsx(node) {
      return !node.parent || !JSX_PARENT_TYPES.has(node.parent.type)
    }

    // A blank line is a violation only when it sits directly inside JSX markup. Blank lines inside
    // embedded JavaScript (e.g. a `.map()` callback block before its `return`) resolve to a
    // non-JSX container node and are left alone, since those follow ordinary statement formatting.
    function isInsideJsxMarkup(index) {
      let node = sourceCode.getNodeByRangeIndex(index)

      while (node && node.type === "JSXText") node = node.parent

      return Boolean(node) && (node.type === "JSXElement" || node.type === "JSXFragment")
    }

    function checkJsx(node) {
      const startLine = node.loc.start.line
      const endLine = node.loc.end.line

      for (let line = startLine + 1; line < endLine; line++) {
        if (reported.has(line)) continue

        const text = sourceCode.lines[line - 1]

        if (text.trim() !== "") continue

        const lineStart = sourceCode.getIndexFromLoc({ line, column: 0 })

        if (!isInsideJsxMarkup(lineStart)) continue

        reported.add(line)

        const removeEnd = lineStart + text.length + 1

        context.report({
          loc: { start: { line, column: 0 }, end: { line, column: text.length } },
          messageId: "blankLine",
          fix(fixer) {
            return fixer.removeRange([lineStart, removeEnd])
          }
        })
      }
    }

    return {
      JSXElement(node) {
        if (isOutermostJsx(node)) checkJsx(node)
      },
      JSXFragment(node) {
        if (isOutermostJsx(node)) checkJsx(node)
      }
    }
  }
}

function walkSkippingNestedFunctions(root, visit) {
  const visitChildren = (node) => {
    for (const key of Object.keys(node)) {
      if (SKIP_WALK_KEYS.has(key)) continue

      const value = node[key]

      if (Array.isArray(value)) {
        for (const child of value) {
          if (child && typeof child.type === "string") walkNode(child)
        }
      } else if (value && typeof value.type === "string") {
        walkNode(value)
      }
    }
  }

  const walkNode = (node) => {
    if (node !== root && NESTED_FUNCTION_TYPES.has(node.type)) return

    visit(node)
    visitChildren(node)
  }

  walkNode(root)
}

function isSafeParseCall(node) {
  return (
    node.type === "CallExpression" &&
    node.callee.type === "MemberExpression" &&
    node.callee.property.type === "Identifier" &&
    node.callee.property.name === "safeParse"
  )
}

function awaitsIo(node) {
  if (node.type !== "AwaitExpression") return false

  const names = collectIdentifierNames(node.argument)

  for (const root of IO_ROOT_IDENTIFIERS) {
    if (names.has(root)) return true
  }

  return false
}

function topLevelStatementOf(node, blockBody) {
  let current = node

  while (current.parent && !blockBody.body.includes(current)) current = current.parent

  return blockBody.body.includes(current) ? current : null
}

const validateBeforeIo = {
  meta: {
    type: "problem",
    docs: {
      description:
        "In mutations, queries, and route handlers, the Zod safeParse validation guard precedes the first database IO await"
    },
    fixable: "code",
    messages: {
      ioBeforeValidation:
        "Database access happens before input is validated. Move the safeParse validation guard above the first database await (see actions.md, queries.md)."
    },
    schema: []
  },
  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode()

    const analyze = (fnNode) => {
      if (!fnNode.body || fnNode.body.type !== "BlockStatement") return

      let firstSafeParse = null
      let firstIo = null

      walkSkippingNestedFunctions(fnNode.body, (node) => {
        if (!firstSafeParse && isSafeParseCall(node)) firstSafeParse = node

        if (awaitsIo(node) && (!firstIo || node.range[0] < firstIo.range[0])) firstIo = node
      })

      if (!firstSafeParse || !firstIo) return
      if (firstIo.range[0] >= firstSafeParse.range[0]) return

      context.report({
        node: firstIo,
        messageId: "ioBeforeValidation",
        fix: buildValidateBeforeIoFix(sourceCode, fnNode.body, firstSafeParse, firstIo)
      })
    }

    return {
      FunctionDeclaration: analyze,
      FunctionExpression: analyze,
      ArrowFunctionExpression: analyze
    }
  }
}

// Hoist the validation guard above the first IO. Emitted only in the clean case: the guard
// declaration and the IO are both direct statements of the same block, the guard is followed by its
// `if (!parsed.success) return ...` check, and the guard references nothing declared by the
// statements it moves above. Otherwise report without a fix.
function buildValidateBeforeIoFix(sourceCode, blockBody, safeParseCall, ioNode) {
  const guardDeclaration = topLevelStatementOf(safeParseCall, blockBody)
  const ioStatement = topLevelStatementOf(ioNode, blockBody)

  if (!guardDeclaration || !ioStatement) return null

  const guardIndex = blockBody.body.indexOf(guardDeclaration)
  const ioIndex = blockBody.body.indexOf(ioStatement)

  if (ioIndex >= guardIndex) return null

  const next = blockBody.body[guardIndex + 1]
  const guardCheck =
    next && next.type === "IfStatement" && hasIdentifierOverlap(next, guardDeclaration)
      ? next
      : null

  const lastGuardStatement = guardCheck ?? guardDeclaration
  const spanned = blockBody.body.slice(ioIndex, guardIndex)

  for (const statement of spanned) {
    if (hasIdentifierOverlap(guardDeclaration, statement)) return null
    if (guardCheck && hasIdentifierOverlap(guardCheck, statement)) return null
  }

  return (fixer) => {
    const text = sourceCode.getText()
    const guardStart = sourceCode.getIndexFromLoc({
      line: guardDeclaration.loc.start.line,
      column: 0
    })
    const guardEnd = lastGuardStatement.range[1]
    const ioStart = sourceCode.getIndexFromLoc({ line: ioStatement.loc.start.line, column: 0 })

    const guardText = text.slice(guardStart, guardEnd)

    return [
      fixer.insertTextBeforeRange([ioStart, ioStart], `${guardText}\n\n`),
      fixer.removeRange([guardStart, guardEnd])
    ]
  }
}

const plugin = {
  rules: {
    "helper-placement": helperPlacement,
    "no-blank-lines-in-jsx-return": noBlankLinesInJsxReturn,
    "validate-before-io": validateBeforeIo
  }
}

export default plugin
