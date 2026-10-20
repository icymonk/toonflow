import type { Locator } from '@playwright/test'

/** shadcn Select(AppSelect): 열고 값(data-value)이나 순서로 고른다 */
export async function pick(select: Locator, value: string | { index: number }) {
  await select.click()
  const page = select.page()
  await (typeof value === 'string' ? page.locator(`[role="option"][data-value="${value}"]`) : page.getByRole('option').nth(value.index)).click()
}
