"use client"

type TaskCardPlaceholderProps = {
  title: string
}

const TaskCardPlaceholder = ({ title }: TaskCardPlaceholderProps) => {
  return (
    <div
      aria-hidden="true"
      className="border-foreground/25 bg-muted/40 rounded-xl border border-dashed px-3 py-3"
    >
      <div className="invisible">
        <p className="line-clamp-2 text-sm leading-snug font-medium">{title}</p>
        <div className="mt-2 h-5" />
      </div>
    </div>
  )
}

export { TaskCardPlaceholder }
