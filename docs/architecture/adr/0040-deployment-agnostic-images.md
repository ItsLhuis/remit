# ADR-0040: Deployment-agnostic images — runtime configuration, one public origin, storage behind the application

- **Status:** Accepted
- **Date:** 2026-09-15

## Context

The self-hosting promise is a single command on a host with Docker and nothing to configure beyond
the basics. Building the installer that keeps it showed that the images it would pull could not
serve any instance but the build machine's own:

- **Deployment values were compiled into the bundle.** `NEXT_PUBLIC_APP_URL` and
  `NEXT_PUBLIC_STORAGE_BASE_URL` were Docker build arguments, and Next.js freezes every
  `NEXT_PUBLIC_*` reference into the output at build time. The auth client's base URL, every storage
  URL rendered in the browser, the Content-Security-Policy's storage origin and the image
  optimizer's allowed remote pattern all carried whatever address the image was built with. The
  published image was built with `localhost`.
- **Browsers talked to object storage directly.** Uploads were presigned `PUT`s to
  `MINIO_PUBLIC_URL`, and public objects were read from MinIO under an anonymous `s3:GetObject`
  bucket policy. That made MinIO a second public origin: it needed its own reachable address, its
  own TLS certificate to avoid mixed content behind an HTTPS site, and a CORS-free path through the
  CSP. The production Compose file published MinIO's API and its console to the host network.
- **The published application image was the worker.** The image workflow built without a `target`,
  and the Dockerfile's last stage is `worker`, so `ghcr.io/itslhuis/remit:latest` started the job
  consumer rather than the web server, and no worker image was published under the name the Compose
  file pulled.
- **The `with-proxy` profile did not exist.** ARCHITECTURE.md described a Compose profile running
  Caddy with automatic TLS; no Compose file has ever had one.

## Decision

**No configuration enters an image.** No variable is `NEXT_PUBLIC_*`, the Dockerfile takes no build
argument, and every deployment value is read at runtime through `lib/config/env.ts`. The instance's
address is one variable, `REMIT_PUBLIC_URL`, validated as an origin with no path, and it replaces
both `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL`. The auth client passes no base URL and resolves to
its own origin.

**Object storage is internal to the deployment.** Browsers reach stored files only through the
application:

- `POST /api/upload/[type]` receives the file as its request body and streams it into the store
  under a key it mints. It sits outside the `proxy.ts` matcher, because Next.js buffers and
  truncates at ten megabytes the body of any request the proxy handles.
- `GET /api/storage/[...key]` streams objects from the public bucket, anonymously, which is the
  exposure that bucket already had. The server-side reader it uses cannot address another bucket.

`MINIO_PUBLIC_URL`, `NEXT_PUBLIC_STORAGE_BASE_URL`, the presigning client and the anonymous bucket
policy are removed, and the production Compose file publishes no MinIO port.

**Two images, each built from an explicit target.** `ghcr.io/itslhuis/remit/app` from `runner` and
`ghcr.io/itslhuis/remit/worker` from `worker`, tagged together in one workflow run.

**The `with-proxy` profile runs Caddy in front of the application only.** Caddy terminates TLS for
`REMIT_PUBLIC_URL` and proxies to the app; the app port is then published on loopback. Because
storage is behind the application, the proxy needs no route to MinIO.

## Consequences

### Positive

- One image serves any address, so an install pulls instead of building, and the image a release
  names is the image every instance runs.
- An instance has one origin, one certificate and one DNS record. The Content-Security-Policy is
  `'self'` for connections and images, and a reverse proxy an operator already runs needs one route.
- MinIO's API and console are no longer on the host network, and no bucket policy exists to be more
  permissive than intended.
- Upload size is enforced by the route that writes the object rather than by a presigned URL's
  scope, and the stored size can never exceed what was checked.

### Negative

- Upload and public-read bytes pass through the application process. Uploads are capped at 25 MB and
  public objects are avatars, logos, images and receipts, so for one instance this is modest, but a
  deployment pointing `MINIO_ENDPOINT` at a remote S3 service pays that bandwidth twice.
- The anonymous storage route has no rate limit, like the anonymous bucket it replaces; its
  responses are marked immutable so a browser does not ask twice.
- Renaming the address variable and removing two storage variables is a breaking change to every
  existing `.env`, recorded in `CHANGELOG.md`.
- A replaced avatar or logo can survive in a browser cache under its old key, because keys are
  cached as immutable.

## Alternatives considered

### Keep direct browser access to storage, and deliver the addresses at runtime

A server component could pass `REMIT_PUBLIC_URL` and a storage origin to the client through React
context, keeping presigned uploads. It was rejected because it removes only the build-time freeze:
MinIO would still need a public address, a certificate, CSP entries and published ports, and every
reverse proxy would still need a second route.

### Build the images on the host during installation

Keeping the build arguments and building per deployment would make the addresses correct. It was
rejected because a Next.js and Chromium build needs memory and minutes a small server may not have,
the result is not the image a release names, and an upgrade would have to rebuild rather than pull.

### Route bucket paths to MinIO through the reverse proxy

Serving path-style bucket URLs from the application's own origin would keep presigned uploads on one
host. It was rejected because it couples every reverse proxy's configuration to bucket names that
derive from `MINIO_BUCKET`, and an operator's own proxy would need the same rules written by hand.

### Rewrite storage requests to MinIO from `proxy.ts`

A proxy rewrite would avoid two route handlers. It was rejected because the proxy buffers request
bodies at ten megabytes, and a rewritten presigned request no longer matches the host its signature
covers.
