import "@testing-library/jest-dom/vitest"

import { afterEach, vi } from "vitest"

import "vitest-axe/extend-expect"

afterEach(async () => {
  await new Promise((resolve) => setTimeout(resolve, 0))
})

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
