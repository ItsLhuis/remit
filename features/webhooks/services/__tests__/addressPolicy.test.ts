import { describe, expect, test } from "vitest"

import { isAddressAllowed, toBareHostname } from "../addressPolicy"

const publicOnly = { allowPrivate: false }
const privateAllowed = { allowPrivate: true }

describe("webhook address policy", () => {
  test.each([["93.184.216.34"], ["1.1.1.1"], ["2606:4700:4700::1111"]])(
    "allows the public address %s",
    (address) => {
      expect(isAddressAllowed(address, publicOnly)).toBe(true)
    }
  )

  // Each of these is somewhere a self-hosted instance's own network answers: the database, Redis,
  // MinIO, the metrics endpoint on localhost, a router's admin page, a cloud metadata service.
  test.each([
    ["127.0.0.1"],
    ["127.10.20.30"],
    ["10.0.0.5"],
    ["172.16.0.1"],
    ["172.31.255.254"],
    ["192.168.1.10"],
    ["100.64.0.1"],
    ["169.254.169.254"],
    ["0.0.0.0"],
    ["::1"],
    ["fc00::1"],
    ["fd12:3456:789a::1"],
    ["fe80::1"],
    ["::ffff:10.0.0.1"],
    ["::ffff:127.0.0.1"],
    ["64:ff9b::a00:1"],
    ["2002:a00:1::1"],
    ["224.0.0.1"]
  ])("refuses the private or reserved address %s", (address) => {
    expect(isAddressAllowed(address, publicOnly)).toBe(false)
  })

  test("admits loopback and private ranges only for a host the operator allowlisted", () => {
    expect(isAddressAllowed("192.168.1.10", privateAllowed)).toBe(true)
    expect(isAddressAllowed("127.0.0.1", privateAllowed)).toBe(true)
  })

  test("refuses link-local and metadata addresses even for an allowlisted host", () => {
    expect(isAddressAllowed("169.254.169.254", privateAllowed)).toBe(false)
    expect(isAddressAllowed("fe80::1", privateAllowed)).toBe(false)
    expect(isAddressAllowed("0.0.0.0", privateAllowed)).toBe(false)
  })

  test("refuses anything that is not an IP address", () => {
    expect(isAddressAllowed("localhost", privateAllowed)).toBe(false)
    expect(isAddressAllowed("", publicOnly)).toBe(false)
  })

  test("strips the brackets a URL puts around an IPv6 literal", () => {
    expect(toBareHostname("[::1]")).toBe("::1")
    expect(toBareHostname("example.com")).toBe("example.com")
  })
})
