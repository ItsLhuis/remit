import "@testing-library/jest-dom/vitest"
import "vitest-axe/extend-expect"

import { vi } from "vitest"

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn()
  }),
  usePathname: vi.fn().mockReturnValue("/"),
  useSearchParams: vi.fn().mockReturnValue(new URLSearchParams()),
  redirect: vi.fn(),
  notFound: vi.fn()
}))
