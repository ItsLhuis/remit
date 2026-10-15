# <change-name> — tasks

Each task is one commit whose body contains `Change: <change-name>, task <n>`. Tick the box in the
same commit. A ticked box is a claim; `next-step` checks it against `git log`.

- [ ] 1. <task title>
  - Do: <what to change, which files or modules>
  - Done when: <observable acceptance>
  - Verify: `<command(s) that prove it, e.g. pnpm exec vitest run <file>>`
