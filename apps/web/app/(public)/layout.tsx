import { type ReactNode } from "react"

// The scroll container for every anonymous document page. `globals.css` pins `html` and `body` to
// `h-full overflow-hidden` because the dashboard scrolls an inner pane beside its sidebar; a public
// route has no such pane, so without this everything below the fold is unreachable — on a phone
// that hid the totals and the payment details of a long invoice entirely.
const PublicLayout = ({ children }: { children: ReactNode }) => (
  <div className="h-full overflow-y-auto">{children}</div>
)

export default PublicLayout
