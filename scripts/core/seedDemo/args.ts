import {
  DEFAULT_DEMO_SEED,
  DEFAULT_DEMO_SEED_SIZE,
  DEMO_SEED_SIZES,
  MAX_DEMO_SEED_CLIENTS,
  MAX_DEMO_SEED_INVOICES,
  MAX_DEMO_SEED_PROJECTS
} from "./inventory"
import { type DemoSeedSize, type SeedDemoCliOptions } from "./types"

type ParseArgsResult = { data: SeedDemoCliOptions } | { error: string }

type CountOptionConfig = {
  label: string
  maximum: number
  minimum: number
}

type CountParseResult = { data: number } | { error: string }

export function parseSeedDemoArgs(argv: string[]): ParseArgsResult {
  const options: SeedDemoCliOptions = {
    countOverrides: {},
    dryRun: false,
    help: false,
    reseed: false,
    seed: DEFAULT_DEMO_SEED,
    size: DEFAULT_DEMO_SEED_SIZE,
    yes: false
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === "--dry-run") {
      options.dryRun = true
      continue
    }

    if (arg === "--help") {
      options.help = true
      continue
    }

    if (arg === "--reseed") {
      options.reseed = true
      continue
    }

    if (arg === "--size") {
      const next = argv[index + 1]

      if (!next) return { error: `--size requires one of: ${DEMO_SEED_SIZES.join(", ")}.` }

      const numericSize = Number(next)

      if (Number.isInteger(numericSize)) {
        const parsedCount = parseBoundedCount({
          label: "--size",
          maximum: MAX_DEMO_SEED_CLIENTS,
          minimum: 1,
          value: next
        })

        if ("error" in parsedCount) return parsedCount

        options.countOverrides.clients = parsedCount.data
        index += 1
        continue
      }

      if (!isDemoSeedSize(next)) {
        return {
          error: `--size must be one of ${DEMO_SEED_SIZES.join(", ")} or a client count from 1 to ${MAX_DEMO_SEED_CLIENTS}.`
        }
      }

      options.size = next
      index += 1
      continue
    }

    if (arg === "--clients") {
      const parsedCount = parseCountOption(argv, index, {
        label: "--clients",
        maximum: MAX_DEMO_SEED_CLIENTS,
        minimum: 1
      })

      if ("error" in parsedCount) return parsedCount

      options.countOverrides.clients = parsedCount.data
      index += 1
      continue
    }

    if (arg === "--projects") {
      const parsedCount = parseCountOption(argv, index, {
        label: "--projects",
        maximum: MAX_DEMO_SEED_PROJECTS,
        minimum: 1
      })

      if ("error" in parsedCount) return parsedCount

      options.countOverrides.projects = parsedCount.data
      index += 1
      continue
    }

    if (arg === "--invoices") {
      const parsedCount = parseCountOption(argv, index, {
        label: "--invoices",
        maximum: MAX_DEMO_SEED_INVOICES,
        minimum: 0
      })

      if ("error" in parsedCount) return parsedCount

      options.countOverrides.invoices = parsedCount.data
      index += 1
      continue
    }

    if (arg === "--yes") {
      options.yes = true
      continue
    }

    if (arg === "--seed") {
      const next = argv[index + 1]

      if (!next) return { error: "--seed requires a number." }

      const seed = Number(next)

      if (!Number.isInteger(seed) || seed < 0) {
        return { error: "--seed must be a non-negative integer." }
      }

      options.seed = seed
      index += 1
      continue
    }

    return { error: `Unknown option: ${arg}` }
  }

  return { data: options }
}

function parseCountOption(
  argv: string[],
  index: number,
  config: CountOptionConfig
): CountParseResult {
  const next = argv[index + 1]

  if (!next) {
    return { error: `${config.label} requires a number.` }
  }

  return parseBoundedCount({ ...config, value: next })
}

function parseBoundedCount(config: CountOptionConfig & { value: string }): CountParseResult {
  const count = Number(config.value)

  if (!Number.isInteger(count) || count < config.minimum || count > config.maximum) {
    return {
      error: `${config.label} must be an integer from ${config.minimum} to ${config.maximum}.`
    }
  }

  return { data: count }
}

function isDemoSeedSize(value: string): value is DemoSeedSize {
  return DEMO_SEED_SIZES.includes(value as DemoSeedSize)
}
