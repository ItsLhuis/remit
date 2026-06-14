const JSX_PARENT_TYPES = new Set([
  "JSXElement",
  "JSXFragment",
  "JSXExpressionContainer",
  "JSXAttribute",
  "JSXSpreadAttribute"
])

const helperPlacement = {
  meta: {
    type: "problem",
    docs: {
      description:
        "R-009: file-private `function` helpers must be declared above the component, not after the last export"
    },
    messages: {
      helperAfterExport:
        "R-009: file-private `function` helper `{{name}}` is declared after the last export. Move it above the component (see components.md)."
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
      description: "R-010: a JSX return tree contains no blank lines"
    },
    fixable: "whitespace",
    messages: {
      blankLine:
        "R-010: no blank lines inside a JSX tree. Separate sections by extracting a sub-component, not blank lines (see code-style.md)."
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

const plugin = {
  rules: {
    "helper-placement": helperPlacement,
    "no-blank-lines-in-jsx-return": noBlankLinesInJsxReturn
  }
}

export default plugin
