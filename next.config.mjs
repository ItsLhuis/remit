function getStorageRemotePattern() {
  const raw = process.env.NEXT_PUBLIC_STORAGE_BASE_URL ?? "http://localhost:9000/remit"

  try {
    const { protocol, hostname, port } = new URL(raw)

    return {
      protocol: /** @type {"http" | "https"} */ (protocol.replace(":", "")),
      hostname,
      ...(port ? { port } : {}),
      pathname: "/**"
    }
  } catch {
    return null
  }
}

const storagePattern = getStorageRemotePattern()

const isDev = process.env.NODE_ENV !== "production"

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  images: {
    qualities: [70, 75, 90],
    ...(storagePattern ? { remotePatterns: [storagePattern] } : {}),
    // Development only, and it must stay that way: the local MinIO in docker-compose.dev.yml is
    // reached over a private address, which the image optimizer refuses by default because
    // fetching private-network URLs on a server's behalf is an SSRF primitive.
    ...(isDev ? { dangerouslyAllowLocalIP: true } : {})
  }
}

export default nextConfig
