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

// A hook is a `use` followed by an uppercase letter, matching the React convention. `user.ts` and
// `useful.ts` are ordinary modules and neither rule below touches them.
const HOOK_NAME_PATTERN = /^use[A-Z]/

function toPosixPath(filename) {
  return filename.replaceAll("\\", "/")
}

function isFunctionInitializer(node) {
  return (
    Boolean(node) && (node.type === "ArrowFunctionExpression" || node.type === "FunctionExpression")
  )
}

// Every name this file both declares as a function and exports, mapped to the node worth reporting.
// Declaration and export are resolved within the one file: a re-export carrying a `source` names a
// function this file cannot see, so it is skipped rather than guessed at.
function collectExportedFunctionNames(program) {
  const declaredFunctions = new Map()

  for (const node of program.body) {
    const declaration = node.type === "ExportNamedDeclaration" ? node.declaration : node

    if (!declaration) continue

    if (declaration.type === "FunctionDeclaration" && declaration.id) {
      declaredFunctions.set(declaration.id.name, declaration.id)
    }

    if (declaration.type === "VariableDeclaration") {
      for (const declarator of declaration.declarations) {
        if (declarator.id.type !== "Identifier") continue
        if (!isFunctionInitializer(declarator.init)) continue

        declaredFunctions.set(declarator.id.name, declarator.id)
      }
    }
  }

  const exported = new Map()

  for (const node of program.body) {
    if (node.type !== "ExportNamedDeclaration") continue

    if (node.declaration) {
      if (node.declaration.type === "FunctionDeclaration" && node.declaration.id) {
        exported.set(node.declaration.id.name, node.declaration.id)
      }

      if (node.declaration.type === "VariableDeclaration") {
        for (const declarator of node.declaration.declarations) {
          if (declarator.id.type !== "Identifier") continue
          if (!isFunctionInitializer(declarator.init)) continue

          exported.set(declarator.id.name, declarator.id)
        }
      }

      continue
    }

    if (node.source) continue

    for (const specifier of node.specifiers) {
      if (specifier.type !== "ExportSpecifier") continue
      if (specifier.local.type !== "Identifier") continue

      const declaredAt = declaredFunctions.get(specifier.local.name)

      if (declaredAt) exported.set(specifier.local.name, specifier)
    }
  }

  return exported
}

const noHookInComponents = {
  meta: {
    type: "problem",
    docs: {
      description: "A React hook is not declared under `features/<feature>/components/`"
    },
    messages: {
      hookInComponents:
        "Hook `{{name}}` is declared under components/. Hooks belong in `features/<feature>/hooks/` (see hooks.md)."
    },
    schema: []
  },
  create(context) {
    const filename = toPosixPath(context.filename ?? context.getFilename())

    if (!/(^|\/)features\/[^/]+\/components\//.test(filename)) return {}
    if (/(^|\/)__tests__\//.test(filename)) return {}

    return {
      "Program:exit"(program) {
        for (const [name, node] of collectExportedFunctionNames(program)) {
          if (!HOOK_NAME_PATTERN.test(name)) continue

          context.report({ node, messageId: "hookInComponents", data: { name } })
        }
      }
    }
  }
}

const hookFileExportsItsHook = {
  meta: {
    type: "problem",
    docs: {
      description: "A `hooks/` file named `use*` exports the hook its filename advertises"
    },
    messages: {
      missingHook:
        "`{{basename}}` is presented as a hook but exports no function named `{{basename}}`. Rename the file after the helper it holds, or export the hook (see hooks.md)."
    },
    schema: []
  },
  create(context) {
    const filename = toPosixPath(context.filename ?? context.getFilename())

    if (!/(^|\/)hooks\//.test(filename)) return {}
    if (/(^|\/)__tests__\//.test(filename)) return {}

    const basename = filename.slice(filename.lastIndexOf("/") + 1).replace(/\.(ts|tsx)$/, "")

    if (basename === "index") return {}
    if (!HOOK_NAME_PATTERN.test(basename)) return {}

    return {
      "Program:exit"(program) {
        if (collectExportedFunctionNames(program).has(basename)) return

        context.report({ node: program, messageId: "missingHook", data: { basename } })
      }
    }
  }
}

const plugin = {
  rules: {
    "helper-placement": helperPlacement,
    "hook-file-exports-its-hook": hookFileExportsItsHook,
    "no-blank-lines-in-jsx-return": noBlankLinesInJsxReturn,
    "no-hook-in-components": noHookInComponents,
    "validate-before-io": validateBeforeIo
  }
}

export default plugin
