import * as p from "@clack/prompts"

import { keysEqual, validateKey } from "../encryption/keyValidation"

import { RotationCliError } from "./errors"

export type RotationKeys = {
  newKey: Buffer
  oldKey: Buffer
}

export async function readRotationKeys(): Promise<RotationKeys> {
  const allowUnattended = process.env.REMIT_ALLOW_UNATTENDED_KEY_ROTATION === "1"
  const rawOldKey = process.env.REMIT_OLD_KEY
  const rawNewKey = process.env.REMIT_NEW_KEY

  if (rawOldKey || rawNewKey) {
    if (!allowUnattended) {
      throw new RotationCliError(
        "Refusing unattended key rotation: REMIT_OLD_KEY and REMIT_NEW_KEY require REMIT_ALLOW_UNATTENDED_KEY_ROTATION=1."
      )
    }

    if (!rawOldKey || !rawNewKey) {
      throw new RotationCliError(
        "Refusing unattended key rotation: set both REMIT_OLD_KEY and REMIT_NEW_KEY."
      )
    }

    return validateKeyPair(rawOldKey, rawNewKey)
  }

  if (allowUnattended) {
    throw new RotationCliError(
      "Refusing unattended key rotation: REMIT_ALLOW_UNATTENDED_KEY_ROTATION=1 requires REMIT_OLD_KEY and REMIT_NEW_KEY."
    )
  }

  const oldKey = await p.password({
    message: "Current REMIT_ENCRYPTION_KEY",
    validate: (value) =>
      typeof value === "string" && value.trim().length > 0 ? undefined : "Current key is required."
  })
  exitOnCancel(oldKey)

  const newKey = await p.password({
    message: "New REMIT_ENCRYPTION_KEY",
    validate: (value) =>
      typeof value === "string" && value.trim().length > 0 ? undefined : "New key is required."
  })
  exitOnCancel(newKey)

  return validateKeyPair(oldKey, newKey)
}

export function validateKeyPair(rawOldKey: string, rawNewKey: string): RotationKeys {
  const oldKey = validateKey(rawOldKey)
  const newKey = validateKey(rawNewKey)

  if (!oldKey.ok) {
    throw new RotationCliError(`Refusing rotation: old key is invalid. ${oldKey.reason}`)
  }

  if (!newKey.ok) {
    throw new RotationCliError(`Refusing rotation: new key is invalid. ${newKey.reason}`)
  }

  if (keysEqual(oldKey.key, newKey.key)) {
    throw new RotationCliError("Refusing rotation: old and new encryption keys are identical.")
  }

  return {
    oldKey: oldKey.key,
    newKey: newKey.key
  }
}

export type RotationRuntimeKeys = {
  oldKey: Buffer
  newKey: Buffer
  currentEnvKey: Buffer
}

export function validateRuntimeKeys(options: RotationRuntimeKeys): void {
  if (options.oldKey.length !== 32) {
    throw new RotationCliError("Refusing rotation: old key must decode to exactly 32 bytes.")
  }

  if (options.newKey.length !== 32) {
    throw new RotationCliError("Refusing rotation: new key must decode to exactly 32 bytes.")
  }

  if (options.currentEnvKey.length !== 32) {
    throw new RotationCliError(
      "Refusing rotation: current REMIT_ENCRYPTION_KEY must decode to exactly 32 bytes."
    )
  }

  if (!keysEqual(options.oldKey, options.currentEnvKey)) {
    throw new RotationCliError(
      "Refusing rotation: key fingerprint mismatch. The old key must match the container's current REMIT_ENCRYPTION_KEY."
    )
  }

  if (keysEqual(options.oldKey, options.newKey)) {
    throw new RotationCliError("Refusing rotation: old and new encryption keys are identical.")
  }
}

function exitOnCancel<T>(value: T | symbol): asserts value is T {
  if (p.isCancel(value)) {
    p.cancel("Encryption key rotation cancelled. No rotation was applied.")
    process.exit(0)
  }
}
