---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# Code Style Rules

## Early Returns

- Always prefer early returns to reduce nesting. Exit as soon as a condition is met rather than
  wrapping the remaining logic in an `else` or deep `if` block.

```ts
// ✓
const handleOpenChange = (next: boolean) => {
  if (!next && step !== "confirm") return

  if (!next) reset()

  setOpen(next)
}

// ✗
const handleOpenChange = (next: boolean) => {
  if (next || step === "confirm") {
    if (!next) reset()
    setOpen(next)
  }
}
```

## Blank Lines Between Logical Groups

- Separate logically distinct statements with a blank line. This applies to hooks, variable
  declarations, and imperative logic alike.
- Group items together **only** when they are tightly coupled (e.g. a `ref` and the derived value
  from it, or two `useState` calls that always change together).
- A blank line is required after the last early return guard before the main logic body.

```ts
// ✓
const [open, setOpen] = useState(false)

const [step, setStep] = useState<Step>("confirm")

const ref = useRef<HTMLDivElement>(null)

const isLastStep = step === "confirm"

// ✓ - tightly coupled, no blank line needed
const [isPending, setIsPending] = useState(false)
const [error, setError] = useState<string | null>(null)
```

## Hook Declaration Order in Components

Declare hooks and derived values in this order, with a blank line between each group:

1. `useState` / `useReducer`
2. `useRef`
3. Custom hooks (`useMyHook`)
4. Derived constants from the above
5. `useEffect` / `useCallback` / `useMemo`

```tsx
// ✓
const [open, setOpen] = useState(false)

const [step, setStep] = useState<Step>("confirm")

const containerRef = useRef<HTMLDivElement>(null)

const { data, isPending } = useMyQuery()

const isLastStep = step === "confirm"

useEffect(() => { ... }, [open])
```

## Function Body Spacing

- Add a blank line between every top-level statement group inside a function when they represent
  different concerns.
- Single-line functions or trivially short functions (≤ 2 statements, same concern) may omit blank
  lines.

## Naming - No Abbreviations

- Always use full, descriptive names for parameters, callbacks, and map/filter/reduce arguments.
  Never use abbreviations or single-letter shorthands.

```ts
// ✓
onChange={(event) => setSearch(event.target.value)}
users.map((user) => user.name)
items.filter((item) => item.active)
values.reduce((accumulator, value) => accumulator + value, 0)

// ✗
onChange={(e) => setSearch(e.target.value)}
users.map((u) => u.name)
items.filter((i) => i.active)
values.reduce((acc, val) => acc + val, 0)
```

- This applies everywhere: event handlers, array methods, promise chains, function parameters.
- Exception: loop indices (`i`, `j`) in `for` loops are acceptable.
