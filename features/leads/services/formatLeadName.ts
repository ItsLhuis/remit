export type LeadNameParts = {
  firstName: string
  lastName: string
  company: string
  email: string
}

export function formatLeadName({ firstName, lastName, company, email }: LeadNameParts): string {
  const fullName = [firstName, lastName]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ")

  if (fullName.length > 0) return fullName

  if (company.trim().length > 0) return company.trim()

  return email.trim()
}
