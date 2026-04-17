#!/bin/sh
# Exit immediately if any command fails.
# This ensures the container stops if migrations fail, rather than
# silently starting the app against an inconsistent database schema.
set -e

echo "[entrypoint] Running database migrations..."
node scripts/migrate.js

echo "[entrypoint] Starting Remit..."
# `exec` replaces the shell process with node, so the node process becomes
# PID 1 and receives OS signals (SIGTERM, SIGINT) directly from Docker.
# Without `exec`, signals would be caught by the shell and node would not
# shut down gracefully on `docker stop`.
exec node server.js
