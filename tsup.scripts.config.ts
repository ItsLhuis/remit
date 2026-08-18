import { defineConfig } from "tsup"

export default defineConfig({
  entry: {
    backup: "scripts/backup.ts",
    migrate: "scripts/migrate.ts",
    "reset-data": "scripts/reset-data.ts",
    "reset-password": "scripts/reset-password.ts",
    restore: "scripts/restore.ts",
    "rotate-encryption-key": "scripts/rotate-encryption-key.ts",
    "seed-demo": "scripts/seed-demo.ts",
    worker: "scripts/worker.ts"
  },
  outDir: "scripts/dist",
  format: ["esm"],
  platform: "node",
  target: "node24",
  clean: true,
  dts: false,
  sourcemap: false,
  splitting: false
})
