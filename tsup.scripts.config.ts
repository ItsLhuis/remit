import { defineConfig } from "tsup"

export default defineConfig({
  entry: {
    backup: "scripts/backup.ts",
    migrate: "scripts/migrate.ts",
    "reset-password": "scripts/reset-password.ts",
    restore: "scripts/restore.ts",
    "seed-demo": "scripts/seed-demo.ts"
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
