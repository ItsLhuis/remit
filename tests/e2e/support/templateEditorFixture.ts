import { type Page } from "@playwright/test"

export async function createTemplateAndOpenEditor(page: Page, name: string): Promise<void> {
  await page.goto("/templates")
  await page.getByRole("button", { name: "Create template" }).click()

  const dialog = page.getByRole("dialog")

  await dialog.getByLabel("Name").fill(name)
  await dialog.getByRole("button", { name: "Create template" }).click()

  await page.waitForURL(/\/templates\/[^/]+$/)
}

export async function addRectangleBlock(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Insert block" }).click()
  await page.getByRole("menuitem", { name: "Rectangle" }).click()
}

export async function addTextBlock(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Insert block" }).click()
  await page.getByRole("menuitem", { name: "Text" }).click()
}

export async function addFrameBlock(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Insert block" }).click()
  await page.getByRole("menuitem", { name: "Frame" }).click()
}
