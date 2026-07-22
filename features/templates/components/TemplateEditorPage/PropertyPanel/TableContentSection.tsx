"use client"

import { useRef } from "react"

import { useTranslation } from "@/lib/i18n"

import { Button, Icon, Input } from "@/components/ui"

import { LINE_ITEM_FIELD_LABEL_KEYS } from "../../../labels"
import {
  LINE_ITEM_FIELDS,
  type Block,
  type LineItemField,
  type TableColumn,
  type TableRow,
  type TemplateType
} from "../../../schemas"
import { supportsLineItems } from "../../../services"

import { FieldRowSelect } from "./FieldRowSelect"
import { MergeVariablePicker } from "./MergeVariablePicker"

type TableBlock = Extract<Block, { type: "table" }>

type TableContentSectionProps = {
  block: TableBlock
  type: TemplateType
  disabled?: boolean
  onChange: (block: TableBlock) => void
}

type CellLocation =
  | { kind: "header"; columnIndex: number }
  | { kind: "cell"; rowIndex: number; cellIndex: number }

const TABLE_MAX_COLUMNS = 8
const TABLE_MAX_ROWS = 50

// The table's structure editor: author-controlled columns and rows in manual mode, or a line-items
// binding per column when the table draws from the document's collection. Headers and manual cells
// are merge-substitutable surfaces, so the picker inserts into whichever of them holds focus.
const TableContentSection = ({ block, type, disabled, onChange }: TableContentSectionProps) => {
  const { t } = useTranslation()

  const focusedCellRef = useRef<{ location: CellLocation; element: HTMLInputElement } | null>(null)

  const { content } = block

  const update = (next: Partial<TableBlock["content"]>) => {
    onChange({ ...block, content: { ...content, ...next } })
  }

  // Switching the source keeps the structure but swaps the binding contract: line-items columns
  // need a binding, manual columns must not carry one.
  const setSource = (source: "manual" | "lineItems") => {
    update({
      source,
      columns: content.columns.map((column) => ({
        ...column,
        binding: source === "lineItems" ? (column.binding ?? "lineItem.description") : null
      }))
    })
  }

  const setColumn = (index: number, next: Partial<TableColumn>) => {
    update({
      columns: content.columns.map((column, position) =>
        position === index ? { ...column, ...next } : column
      )
    })
  }

  const addColumn = () => {
    update({
      columns: [
        ...content.columns,
        {
          id: crypto.randomUUID(),
          header: "",
          width: null,
          binding: content.source === "lineItems" ? "lineItem.description" : null
        }
      ],
      rows: content.rows.map((row) => ({ ...row, cells: [...row.cells, ""] }))
    })
  }

  const removeColumn = (index: number) => {
    update({
      columns: content.columns.filter((_, position) => position !== index),
      rows: content.rows.map((row) => ({
        ...row,
        cells: row.cells.filter((_, position) => position !== index)
      }))
    })
  }

  const setCell = (rowIndex: number, cellIndex: number, value: string) => {
    update({
      rows: content.rows.map((row, position) =>
        position === rowIndex
          ? { ...row, cells: row.cells.map((cell, cp) => (cp === cellIndex ? value : cell)) }
          : row
      )
    })
  }

  const addRow = () => {
    const row: TableRow = { id: crypto.randomUUID(), cells: content.columns.map(() => "") }

    update({ rows: [...content.rows, row] })
  }

  const removeRow = (index: number) => {
    update({ rows: content.rows.filter((_, position) => position !== index) })
  }

  const insertAtFocusedCell = (identifier: string) => {
    const focused = focusedCellRef.current

    if (!focused) return

    const token = `{{${identifier}}}`
    const { location, element } = focused

    const current =
      location.kind === "header"
        ? (content.columns[location.columnIndex]?.header ?? "")
        : (content.rows[location.rowIndex]?.cells[location.cellIndex] ?? "")

    const start = element.selectionStart ?? current.length
    const end = element.selectionEnd ?? current.length
    const next = `${current.slice(0, start)}${token}${current.slice(end)}`

    if (location.kind === "header") {
      setColumn(location.columnIndex, { header: next })
    } else {
      setCell(location.rowIndex, location.cellIndex, next)
    }

    requestAnimationFrame(() => {
      element.focus()
      element.setSelectionRange(start + token.length, start + token.length)
    })
  }

  const trackFocus = (location: CellLocation) => (event: { currentTarget: HTMLInputElement }) => {
    focusedCellRef.current = { location, element: event.currentTarget }
  }

  return (
    <div className="flex flex-col gap-2.5">
      <FieldRowSelect
        id={`${block.id}-table-source`}
        label={t("templates.editor.tableSource")}
        value={content.source}
        options={[
          { value: "manual", label: t("templates.editor.tableSourceManual") },
          ...(supportsLineItems(type)
            ? [{ value: "lineItems", label: t("templates.editor.tableSourceLineItems") }]
            : [])
        ]}
        disabled={disabled}
        onChange={(source) => setSource(source as "manual" | "lineItems")}
      />
      <div className="flex flex-col gap-2">
        {content.columns.map((column, columnIndex) => (
          <div key={column.id} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <Input
                value={column.header}
                placeholder={t("templates.editor.tableHeaderPlaceholder", {
                  column: columnIndex + 1
                })}
                aria-label={t("templates.editor.tableHeaderPlaceholder", {
                  column: columnIndex + 1
                })}
                disabled={disabled}
                onFocus={trackFocus({ kind: "header", columnIndex })}
                onChange={(event) => setColumn(columnIndex, { header: event.target.value })}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={disabled || content.columns.length <= 1}
                aria-label={t("templates.editor.tableRemoveColumn")}
                className="text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => removeColumn(columnIndex)}
              >
                <Icon name="X" aria-hidden="true" className="size-3.5" />
              </Button>
            </div>
            {content.source === "lineItems" ? (
              <FieldRowSelect
                id={`${column.id}-binding`}
                label={t("templates.editor.tableBinding")}
                value={column.binding ?? "lineItem.description"}
                options={LINE_ITEM_FIELDS.map((field) => ({
                  value: field,
                  label: t(LINE_ITEM_FIELD_LABEL_KEYS[field])
                }))}
                disabled={disabled}
                onChange={(binding) =>
                  setColumn(columnIndex, { binding: binding as LineItemField })
                }
              />
            ) : null}
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || content.columns.length >= TABLE_MAX_COLUMNS}
          onClick={addColumn}
        >
          <Icon name="Plus" aria-hidden="true" />
          {t("templates.editor.tableAddColumn")}
        </Button>
      </div>
      {content.source === "manual" ? (
        <div className="flex flex-col gap-2">
          {content.rows.map((row, rowIndex) => (
            <div key={row.id} className="flex items-center gap-1.5">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                {row.cells.map((cell, cellIndex) => (
                  <Input
                    key={`${row.id}-${content.columns[cellIndex]?.id ?? cellIndex}`}
                    value={cell}
                    placeholder={t("templates.editor.tableCellPlaceholder", {
                      row: rowIndex + 1,
                      column: cellIndex + 1
                    })}
                    aria-label={t("templates.editor.tableCellPlaceholder", {
                      row: rowIndex + 1,
                      column: cellIndex + 1
                    })}
                    disabled={disabled}
                    onFocus={trackFocus({ kind: "cell", rowIndex, cellIndex })}
                    onChange={(event) => setCell(rowIndex, cellIndex, event.target.value)}
                  />
                ))}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={disabled}
                aria-label={t("templates.editor.tableRemoveRow")}
                className="text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => removeRow(rowIndex)}
              >
                <Icon name="Trash2" aria-hidden="true" className="size-3.5" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || content.rows.length >= TABLE_MAX_ROWS}
            onClick={addRow}
          >
            <Icon name="Plus" aria-hidden="true" />
            {t("templates.editor.tableAddRow")}
          </Button>
        </div>
      ) : null}
      <MergeVariablePicker type={type} disabled={disabled} onInsert={insertAtFocusedCell} />
    </div>
  )
}

export { TableContentSection }
