"use client"

import { type ComponentProps, type DragEvent, useId, useState } from "react"

import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

import { Icon } from "@/components/ui/Icon"
import { Typography } from "@/components/ui/Typography"

// Hoisted rather than declared per render: dragover only has to be cancelled for the drop event to
// fire at all, so it closes over nothing.
function allowDrop(event: DragEvent<HTMLLabelElement>): void {
  event.preventDefault()
}

const fileDropzoneVariants = cva(
  "border-input has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-ring/50 relative flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-center transition-colors has-[input:focus-visible]:ring-[3px] data-[dragging=true]:border-solid data-[dragging=true]:border-ring data-[dragging=true]:bg-accent/50 data-[disabled=true]:opacity-50",
  {
    variants: {
      size: {
        default: "min-h-40 p-6",
        compact: "min-h-0 px-4 py-3"
      }
    },
    defaultVariants: {
      size: "default"
    }
  }
)

type FileDropzoneProps = Omit<ComponentProps<"label">, "onDrop"> &
  VariantProps<typeof fileDropzoneVariants> & {
    accept: readonly string[]
    multiple?: boolean
    disabled?: boolean
    label: string
    dropLabel: string
    description?: string
    onFiles: (files: File[]) => void
  }

// The whole drop target IS the `<label>` for an `sr-only` `<input type="file">`, never a `<div>` with
// handlers on it. Three things follow, and all three are the reason for the shape: the input keeps
// the native keyboard path (Tab to focus, Space or Enter to open the picker) and the native
// accessible name; `has-[input:focus-visible]` lets the zone show that focus with no JavaScript; and
// a `<label>` is a native interactive element, so hanging the drag handlers on it does not trip
// `jsx-a11y/no-static-element-interactions` the way a handler-bearing `<div>` would
// (accessibility.md).
//
// `dragDepth` counts enter/leave rather than toggling a boolean: dragging across a child element
// fires `dragleave` on the parent, so a boolean flickers the drag state off and on for the whole
// crossing.
//
// The drag-over state carries three non-colour signals — the border turns solid, the icon changes,
// and the label text changes — because colour alone is not a permitted state signal.
const FileDropzone = ({
  accept,
  multiple = false,
  disabled = false,
  label,
  dropLabel,
  description,
  size,
  className,
  onFiles,
  ...props
}: FileDropzoneProps) => {
  const inputId = useId()

  const [dragDepth, setDragDepth] = useState(0)

  const isDragging = dragDepth > 0 && !disabled

  const handleDragEnter = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setDragDepth((depth) => depth + 1)
  }

  const handleDragLeave = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setDragDepth((depth) => Math.max(0, depth - 1))
  }

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setDragDepth(0)

    if (disabled) return

    const dropped = Array.from(event.dataTransfer.files)

    if (dropped.length > 0) onFiles(multiple ? dropped : dropped.slice(0, 1))
  }

  return (
    // The rule wants a role and keyboard support added to an element carrying listeners. Neither
    // applies: the keyboard and pointer path is the nested `<input type="file">` this label is for,
    // which is already focusable, already announced, and already opens the picker on Space or Enter.
    // The drag handlers are a pointer-only enhancement on top of that control, and there is no ARIA
    // role for "a label you may also drop files on".
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <label
      htmlFor={inputId}
      data-slot="file-dropzone"
      data-dragging={isDragging}
      data-disabled={disabled}
      className={cn(fileDropzoneVariants({ size, className }), !disabled && "cursor-pointer")}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={allowDrop}
      onDrop={handleDrop}
      {...props}
    >
      <input
        id={inputId}
        data-slot="file-dropzone-input"
        type="file"
        accept={accept.join(",")}
        multiple={multiple}
        disabled={disabled}
        className="sr-only"
        onChange={(event) => {
          const selected = Array.from(event.target.files ?? [])
          // Cleared before the caller runs so the same file can be picked again after a failure; a
          // file input fires no change event when its value is unchanged.
          event.target.value = ""
          if (selected.length > 0) onFiles(selected)
        }}
      />
      <Icon
        name={isDragging ? "FilePlus2" : "Upload"}
        className="text-muted-foreground size-5"
        aria-hidden="true"
      />
      <Typography affects="small" className="font-medium" data-slot="file-dropzone-label">
        {isDragging ? dropLabel : label}
      </Typography>
      {description ? (
        <Typography affects={["muted", "tiny"]} data-slot="file-dropzone-description">
          {description}
        </Typography>
      ) : null}
    </label>
  )
}

export { FileDropzone }
