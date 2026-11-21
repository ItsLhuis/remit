import { type ReactNode } from "react"

// The template editor is a full-viewport working surface: no app sidebar, no dashboard chrome.
// Only the editor's own panels and canvas scroll.
const TemplateEditorLayout = ({ children }: { children: ReactNode }) => {
  return <div className="h-svh overflow-hidden">{children}</div>
}

export default TemplateEditorLayout
