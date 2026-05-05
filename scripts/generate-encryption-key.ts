import { randomBytes } from "node:crypto"

const key = randomBytes(32).toString("base64")
process.stdout.write(key + "\n")
