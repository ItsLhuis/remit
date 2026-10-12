# ADR-0050: Error frames are resolved in the process, against maps the image ships

- **Status:** Accepted
- **Date:** 2026-10-12
- **Supersedes:** [ADR-0041](0041-error-tracking-boundary.md) on one point, its consequence that
  server stack frames point into minified chunks the receiver cannot map. Every decision of ADR-0041
  stands: events are built by addition, the message is never sent, and nothing is uploaded.

## Context

A reported server error carried frames like `_12k6sgi._.js:182:40605` under a function called `aG`,
and a Drizzle query error arrived typed `Error`, because the production build minifies every server
chunk and renames its bindings. Next.js's standalone output, which the image is made of, keeps the
chunks but only a few of their source maps.

The usual fix uploads the maps to the receiver at build time. ADR-0040 and ADR-0041 rule that out:
the image carries no deployment, so at build time there is no receiver and no credential to upload
with.

Turbopack's maps also name nothing. A renamed binding maps to the right source position with no
record of what it was called, so even a receiver holding the maps could recover a file and a line
but not a function or a class.

## Decision

**The image ships every server chunk's map, and the process resolves its own frames.** After
`pnpm build`, the Dockerfile's builder stage runs `scripts/ship-server-source-maps.ts`, which puts
each chunk's map beside the chunk the standalone output kept. When an error is reported,
`lib/errorTracking/sourceMaps.ts` turns each frame's chunk position into the source file, line and
column it came from before `buildErrorEvent` builds the event.

**The build writes back the names the minifier dropped, then drops the source text.** While
`sourcesContent` is still there, every mapping that starts a renamed identifier gets the source's
name for it, which is the field the source map format defines for this. The map then ships without
`sourcesContent`. That makes the image about 46 MB larger rather than about 127 MB, and puts no
source text on a host. A frame's function is named from the nearest preceding definition of its
minified name. An error class the bundle renamed is named from its declaration's position in the
chunk, and is reported as `Error` rather than under a minified name when that position cannot be
found.

**Nothing new leaves the instance.** A recovered path or name passes the same allowlist patterns as
one read from the stack. The resolver reads only maps beside `.js` files under the working
directory, and never reads `sourcesContent`.

## Consequences

### Positive

- An event names the source file, line, function and error class an operator needs, with no
  receiver-side setup and no build-time credential.
- Resolution runs only when an error is reported, and at most 32 chunks' parsed maps are cached.

### Negative

- The image grows by the maps, about 46 MB uncompressed.
- A function name is recovered heuristically, from the nearest preceding `function <name>(`, or from
  the caller's call expression when there is none. An arrow function assigned to a minified name is
  not recovered and its frame carries no function name.
- The maps are decoded by Remit's own code (`lib/errorTracking/sourceMapCodec.ts`) rather than by
  `node:module`'s `SourceMap`, whose `findEntry` carries the last decoded name forward onto every
  later segment that has none.

## Alternatives considered

### Node's own source-map support

`--enable-source-maps`, or `process.setSourceMapsEnabled(true)` once a DSN is set, rewrites every
stack the process renders. It was rejected because it keeps every loaded chunk's map in memory for
the life of the process, and maps every stack any code renders in order to serve the rare error that
is reported. It also cannot recover names that Turbopack's maps do not carry.

### Uploading maps to the receiver

The standard route, rejected for the reason in the Context: it needs a receiver and a credential at
build time, and the image has neither.

### Turning off server minification

Next.js 16's Turbopack exposes one minification switch for client and server output together, so
this would also unminify every browser bundle.

### Shipping the maps with their source text

Shipping `sourcesContent` would make names recoverable at runtime instead of at build time. It was
rejected because it triples the size of the maps and puts every bundled dependency's source on every
host.
