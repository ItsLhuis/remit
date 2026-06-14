import { type ClientDetail, type ClientFormData } from "../types"

export function toClientFormData(client: ClientDetail): ClientFormData {
  return {
    id: client.id,
    name: client.name,
    email: client.email,
    phone: client.phone,
    currency: client.currency,
    taxId: client.taxId,
    addressLine1: client.address.line1,
    addressLine2: client.address.line2,
    city: client.address.city,
    state: client.address.state,
    postalCode: client.address.postalCode,
    country: client.address.country,
    notes: client.notes,
    website: client.website
  }
}
