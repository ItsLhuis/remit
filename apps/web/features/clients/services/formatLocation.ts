import { type ClientDetail } from "../types"

export function formatLocation(client: ClientDetail): string {
  return [client.address.city, client.address.state, client.address.country]
    .filter(Boolean)
    .join(", ")
}
