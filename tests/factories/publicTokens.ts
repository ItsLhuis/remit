// Narrows the nullable `public_token` column for tests that need the URL a factory row was minted
// with. Null is the revoked state (ADR-0029), and every factory mints a live token, so a null here
// means the row under test is not the one the test thinks it is — throwing says that immediately
// instead of the test failing later on an unrelated assertion.
export function publicTokenOf(document: { publicToken: string | null }): string {
  if (!document.publicToken) throw new Error("Factory row was created without a public token")

  return document.publicToken
}
