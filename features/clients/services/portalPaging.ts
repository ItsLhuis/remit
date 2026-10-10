export const PORTAL_PAGE_SIZE = 10

export type PortalPageWindow = {
  page: number
  pageCount: number
  offset: number
}

// A requested page past the end lands on the last page rather than on an empty list: a link kept
// from before a document was withdrawn should still show the client something.
export function resolvePortalPage(requestedPage: number, totalRows: number): PortalPageWindow {
  const pageCount = Math.max(1, Math.ceil(totalRows / PORTAL_PAGE_SIZE))
  const page = Math.min(Math.max(1, requestedPage), pageCount)

  return { page, pageCount, offset: (page - 1) * PORTAL_PAGE_SIZE }
}
