import { createServer, type IncomingMessage, type Server } from "node:http"

import { type AddressInfo } from "node:net"

export type S3TestServer = {
  endpoint: string
  objects: Map<string, S3TestObject>
  close: () => Promise<void>
}

export type S3TestObject = {
  body: Buffer
  createdAt: Date
}

export async function startS3TestServer(): Promise<S3TestServer> {
  const objects = new Map<string, S3TestObject>()
  const server = createServer((request, response) => {
    void handleS3Request(objects, request)
      .then((result) => {
        response.statusCode = result.statusCode

        for (const [name, value] of Object.entries(result.headers ?? {})) {
          response.setHeader(name, value)
        }

        response.end(result.body)
      })
      .catch(() => {
        response.statusCode = 500
        response.setHeader("content-type", "application/xml")
        response.end(s3ErrorXml("InternalError", "The test S3 server failed."))
      })
  })

  await listen(server)
  const address = server.address()

  if (!isAddressInfo(address)) {
    await closeServer(server)
    throw new Error("The test S3 server did not expose a TCP address.")
  }

  return {
    close: async () => {
      await closeServer(server)
    },
    endpoint: `http://127.0.0.1:${address.port}`,
    objects
  }
}

async function handleS3Request(
  objects: Map<string, S3TestObject>,
  request: IncomingMessage
): Promise<{ body?: Buffer | string; headers?: Record<string, string>; statusCode: number }> {
  const parsed = parseS3Request(request.url)

  if (!parsed.bucket) {
    return { body: s3ErrorXml("NoSuchBucket", "Bucket is required."), statusCode: 404 }
  }

  if (request.method === "HEAD" && !parsed.key) {
    return { statusCode: 200 }
  }

  if (request.method === "PUT" && !parsed.key) {
    await readRequestBody(request)
    return { statusCode: 200 }
  }

  if (request.method === "GET" && parsed.searchParams.has("list-type")) {
    return {
      body: listBucketXml(parsed.bucket, parsed.searchParams.get("prefix") ?? "", objects),
      headers: { "content-type": "application/xml" },
      statusCode: 200
    }
  }

  if (request.method === "PUT" && parsed.key) {
    objects.set(parsed.key, { body: await readRequestBody(request), createdAt: new Date() })

    return { statusCode: 200 }
  }

  if (request.method === "GET" && parsed.key) {
    const object = objects.get(parsed.key)

    if (!object) {
      return {
        body: s3ErrorXml("NoSuchKey", "The specified key does not exist."),
        headers: { "content-type": "application/xml" },
        statusCode: 404
      }
    }

    return {
      body: object.body,
      headers: {
        "content-length": String(object.body.length),
        "content-type": "application/octet-stream",
        "last-modified": object.createdAt.toUTCString()
      },
      statusCode: 200
    }
  }

  if (request.method === "DELETE" && parsed.key) {
    objects.delete(parsed.key)

    return { statusCode: 204 }
  }

  return {
    body: s3ErrorXml(
      "NotImplemented",
      "The requested operation is not implemented by the test server."
    ),
    headers: { "content-type": "application/xml" },
    statusCode: 501
  }
}

function parseS3Request(requestUrl: string | undefined): {
  bucket: string
  key: string
  searchParams: URLSearchParams
} {
  const url = new URL(requestUrl ?? "/", "http://127.0.0.1")
  const [bucket = "", ...keyParts] = url.pathname.split("/").filter(Boolean)

  return {
    bucket,
    key: keyParts.map(decodeURIComponent).join("/"),
    searchParams: url.searchParams
  }
}

async function readRequestBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = []

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  return Buffer.concat(chunks)
}

function listBucketXml(bucket: string, prefix: string, objects: Map<string, S3TestObject>): string {
  const matches = Array.from(objects.entries())
    .filter(([key]) => key.startsWith(prefix))
    .sort(([left], [right]) => left.localeCompare(right))
  const contents = matches
    .map(
      ([key, object]) => `
  <Contents>
    <Key>${escapeXml(key)}</Key>
    <LastModified>${object.createdAt.toISOString()}</LastModified>
    <Size>${object.body.length}</Size>
  </Contents>`
    )
    .join("")

  return `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Name>${escapeXml(bucket)}</Name>
  <Prefix>${escapeXml(prefix)}</Prefix>
  <KeyCount>${matches.length}</KeyCount>
  <MaxKeys>1000</MaxKeys>
  <IsTruncated>false</IsTruncated>${contents}
</ListBucketResult>`
}

function s3ErrorXml(code: string, message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Error>
  <Code>${escapeXml(code)}</Code>
  <Message>${escapeXml(message)}</Message>
</Error>`
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}

async function listen(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject)
      resolve()
    })
  })
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
    server.closeIdleConnections()
  })
}

function isAddressInfo(address: AddressInfo | string | null): address is AddressInfo {
  return typeof address === "object" && address !== null && "port" in address
}
