// Decides whether a shell command an agent is about to run respects the agents' git policy
// (AGENTS.md, Owner decisions): local commits of explicitly staged paths only. Claude Code's
// prefix deny rules miss `git -C dir push`, `git -c x=y push`, chained commands and `sh -c` bodies;
// this parser closes those gaps for the PreToolUse hook in `.claude/hooks/git-guard.mjs`. It is
// pure so `tools/git-guard/__tests__/classify.test.ts` can pin every case.

const FORBIDDEN_SUBCOMMANDS = new Set([
  "push",
  "reset",
  "checkout",
  "switch",
  "restore",
  "clean",
  "stash",
  "merge",
  "rebase",
  "cherry-pick",
  "tag",
  "worktree",
  "am",
  "filter-branch",
  "filter-repo",
  "update-ref",
  "replace"
])

const GLOBAL_OPTIONS_WITH_VALUE = new Set(["-C", "-c", "--git-dir", "--work-tree", "--namespace"])

const BRANCH_LISTING_FLAGS = new Set([
  "-a",
  "--all",
  "-r",
  "--remotes",
  "-l",
  "--list",
  "-v",
  "-vv",
  "--verbose",
  "--show-current",
  "--no-color",
  "--color"
])

const ADD_FORBIDDEN_FLAGS = new Set([
  "-A",
  "--all",
  "-u",
  "--update",
  "-f",
  "--force",
  "--no-ignore-removal"
])

const ADD_FORBIDDEN_PATHS = new Set([".", "./", ":/", ":", "*", "-"])

const COMMIT_FORBIDDEN_LONG_FLAGS = new Set(["--amend", "--no-verify", "--all"])

// Short commit flags that are refused even inside a cluster such as `-nm`: `n` skips hooks and `a`
// stages every tracked change, which is `git add -u` by another name.
const COMMIT_FORBIDDEN_SHORT_FLAGS = ["n", "a"]

const COMMIT_SHORT_FLAGS_WITH_VALUE = new Set(["m", "F", "C", "c", "t", "S"])

const HOOK_BYPASS_PATTERNS = [
  /\bHUSKY\s*=\s*0\b/,
  /\$env:HUSKY\b/i,
  /core\.hooksPath/i,
  /--no-verify\b/
]

const NESTED_SHELLS = new Set(["sh", "bash", "zsh", "pwsh", "powershell", "cmd", "cmd.exe"])

const WRAPPERS = new Set(["command", "builtin", "nohup", "time", "timeout", "nice", "env", "xargs"])

function deny(reason) {
  return { allowed: false, reason }
}

const ALLOWED = { allowed: true }

// Splits on command separators outside quotes and tokenizes each part, honouring single and double
// quotes. Good enough for the commands agents write; anything it cannot read stays a plain token
// and is judged by the rules below.
function parseSegments(command) {
  const segments = [[]]
  let token = ""
  let hasToken = false
  let quote = ""

  const pushToken = () => {
    if (hasToken) segments[segments.length - 1].push(token)

    token = ""
    hasToken = false
  }

  for (let index = 0; index < command.length; index++) {
    const character = command[index]

    if (quote) {
      if (character === quote) quote = ""
      else token += character

      continue
    }

    if (character === "'" || character === '"') {
      quote = character
      hasToken = true

      continue
    }

    if (/[;&|\n\r(){}]/.test(character)) {
      pushToken()
      segments.push([])

      continue
    }

    if (/\s/.test(character)) {
      pushToken()

      continue
    }

    token += character
    hasToken = true
  }

  pushToken()

  return segments.filter((segment) => segment.length > 0)
}

function isGitExecutable(token) {
  return /(^|[\\/])git(\.exe)?$/i.test(token)
}

function stripPrefix(tokens) {
  let index = 0

  while (index < tokens.length) {
    const token = tokens[index]

    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(token) || WRAPPERS.has(token)) index++
    else if (/^-/.test(token) && index > 0 && WRAPPERS.has(tokens[index - 1])) index++
    else if (/^\d+(\.\d+)?[smhd]?$/.test(token) && tokens[index - 1] === "timeout") index++
    else break
  }

  return tokens.slice(index)
}

function classifyAdd(args, isDirectory) {
  for (const arg of args) {
    if (arg === "--") continue
    if (ADD_FORBIDDEN_FLAGS.has(arg)) return deny(`git add ${arg} stages more than explicit paths`)
    if (/^-[a-zA-Z]+$/.test(arg) && /[Auf]/.test(arg.slice(1))) {
      return deny(`git add ${arg} stages more than explicit paths`)
    }
    if (arg.startsWith("-")) continue
    if (ADD_FORBIDDEN_PATHS.has(arg) || /[*?[]/.test(arg)) {
      return deny(`git add ${arg} is not an explicit path`)
    }
    if (isDirectory(arg)) return deny(`git add ${arg} stages a whole directory; list the files`)
  }

  return ALLOWED
}

function classifyCommit(args) {
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]

    if (arg === "--") break
    if (COMMIT_FORBIDDEN_LONG_FLAGS.has(arg.split("=")[0]))
      return deny(`git commit ${arg} is not allowed`)
    if (/^-[a-zA-Z]+/.test(arg) && !arg.startsWith("--")) {
      for (const flag of arg.slice(1)) {
        if (COMMIT_FORBIDDEN_SHORT_FLAGS.includes(flag))
          return deny(`git commit -${flag} is not allowed`)

        // Everything after a value-taking flag in the same cluster is its value (`-mfix`).
        if (COMMIT_SHORT_FLAGS_WITH_VALUE.has(flag)) {
          if (arg.endsWith(flag)) index++

          break
        }
      }
    }
  }

  return ALLOWED
}

function classifyBranch(args) {
  const changes = args.filter((arg) => !BRANCH_LISTING_FLAGS.has(arg))

  return changes.length === 0 ? ALLOWED : deny(`git branch ${changes.join(" ")} changes branches`)
}

function classifyGit(args, isDirectory) {
  let index = 0

  while (index < args.length && args[index].startsWith("-")) {
    const option = args[index]

    if (GLOBAL_OPTIONS_WITH_VALUE.has(option)) index += 2
    else index++
  }

  const subcommand = args[index]
  const rest = args.slice(index + 1)

  if (subcommand === undefined) return ALLOWED
  if (FORBIDDEN_SUBCOMMANDS.has(subcommand))
    return deny(`git ${subcommand} is reserved for the owner`)
  if (subcommand === "add") return classifyAdd(rest, isDirectory)
  if (subcommand === "commit") return classifyCommit(rest)
  if (subcommand === "branch") return classifyBranch(rest)
  if (subcommand === "config" && rest.some((arg) => /core\.hooksPath/i.test(arg))) {
    return deny("changing core.hooksPath bypasses the hooks")
  }

  return ALLOWED
}

export function classifyCommand(command, isDirectory) {
  if (/\bgit\b/i.test(command) && HOOK_BYPASS_PATTERNS.some((pattern) => pattern.test(command))) {
    return deny("bypassing git hooks is not allowed")
  }

  for (const segment of parseSegments(command)) {
    const tokens = stripPrefix(segment)
    const [program, ...args] = tokens

    if (program === undefined) continue

    if (NESTED_SHELLS.has(program.toLowerCase())) {
      const body = args.find(
        (arg, position) => position > 0 && /^-(c|Command|command)$/i.test(args[position - 1])
      )

      if (body !== undefined) {
        const verdict = classifyCommand(body, isDirectory)

        if (!verdict.allowed) return verdict
      }

      continue
    }

    if (isGitExecutable(program)) {
      const verdict = classifyGit(args, isDirectory)

      if (!verdict.allowed) return verdict
    }
  }

  return ALLOWED
}
