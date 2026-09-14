import { BlockList, isIP } from "node:net"

// The address half of the SSRF defence (ADR-0039). A webhook URL is typed by a user and fetched by
// the server, and a self-hosted server sits inside a private network: a naive fetcher pointed at
// `http://postgres:5432`, `http://redis:6379`, the MinIO console, `/api/metrics` on localhost, or a
// cloud metadata service at 169.254.169.254 would make Remit itself the attacker's client. Every
// range below reads as paranoia until one is removed.
//
// `net.BlockList` rather than prefix string matching, because it compares numerically and matches
// an IPv4 rule against the IPv4-mapped IPv6 spelling of the same address (`::ffff:10.0.0.1`), which
// is precisely the notation a string check misses.

// Refused even for a host the operator allowlisted: nothing legitimate receives a webhook at an
// unspecified, link-local, multicast or reserved address, and link-local is where metadata services
// answer.
const alwaysForbidden = new BlockList()

alwaysForbidden.addSubnet("0.0.0.0", 8, "ipv4")
alwaysForbidden.addSubnet("169.254.0.0", 16, "ipv4")
alwaysForbidden.addSubnet("224.0.0.0", 4, "ipv4")
alwaysForbidden.addSubnet("240.0.0.0", 4, "ipv4")
alwaysForbidden.addAddress("::", "ipv6")
alwaysForbidden.addSubnet("fe80::", 10, "ipv6")
alwaysForbidden.addSubnet("ff00::", 8, "ipv6")

// Refused unless the operator allowlisted the host: loopback, the RFC 1918 and carrier-grade NAT
// ranges, documentation and benchmarking ranges, IPv6 unique-local and loopback, and the two IPv6
// prefixes that embed an IPv4 address (NAT64 and 6to4), through which a private IPv4 target could
// otherwise be spelled.
const privateRanges = new BlockList()

privateRanges.addSubnet("10.0.0.0", 8, "ipv4")
privateRanges.addSubnet("100.64.0.0", 10, "ipv4")
privateRanges.addSubnet("127.0.0.0", 8, "ipv4")
privateRanges.addSubnet("172.16.0.0", 12, "ipv4")
privateRanges.addSubnet("192.0.0.0", 24, "ipv4")
privateRanges.addSubnet("192.0.2.0", 24, "ipv4")
privateRanges.addSubnet("192.168.0.0", 16, "ipv4")
privateRanges.addSubnet("198.18.0.0", 15, "ipv4")
privateRanges.addSubnet("198.51.100.0", 24, "ipv4")
privateRanges.addSubnet("203.0.113.0", 24, "ipv4")
privateRanges.addAddress("::1", "ipv6")
privateRanges.addSubnet("fc00::", 7, "ipv6")
privateRanges.addSubnet("64:ff9b::", 96, "ipv6")
privateRanges.addSubnet("2002::", 16, "ipv6")
privateRanges.addSubnet("2001:db8::", 32, "ipv6")
privateRanges.addSubnet("100::", 64, "ipv6")

export type AddressPolicy = {
  allowPrivate: boolean
}

export function isAddressAllowed(address: string, policy: AddressPolicy): boolean {
  const family = isIP(address)

  if (family === 0) return false

  const type = family === 4 ? "ipv4" : "ipv6"

  if (alwaysForbidden.check(address, type)) return false

  if (privateRanges.check(address, type)) return policy.allowPrivate

  return true
}

// A URL's hostname carries an IPv6 literal in brackets (`[::1]`); `net` wants it bare.
export function toBareHostname(hostname: string): string {
  return hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname
}
