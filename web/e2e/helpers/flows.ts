import type { Page } from '@playwright/test'
import { OEJTS_ITEMS } from '../../src/domain/oejts'

export async function begin(page: Page, alias: string) {
  await page.goto('/personality-test')
  await page.getByPlaceholder(/username/i).fill(alias)
  await page.getByRole('button', { name: /begin/i }).click()
}

/** Answer all 32 items by clicking the middle radio each time. */
export async function answerAll(page: Page) {
  for (let i = 0; i < OEJTS_ITEMS.length; i++) {
    await page.getByRole('radio').nth(2).click()
    await page.waitForTimeout(240)
  }
}

/**
 * Dismiss the sharing prompt that appears after all 32 answers are submitted.
 * The app transitions: test → sharing → result. This clicks "No, keep private"
 * so the smoke test reaches the result screen without needing a live session.
 */
export async function dismissSharing(page: Page) {
  await page.getByRole('button', { name: /no, keep private/i }).click()
}
