import type { Page } from '@playwright/test'
import { OEJTS_ITEMS } from '../../src/domain/oejts'

export async function begin(page: Page, alias: string) {
  await page.goto('/personality-test')
  await page.getByPlaceholder(/username/i).fill(alias)
  await page.getByRole('button', { name: /begin/i }).click()
}

export async function signInAdmin(page: Page, email: string) {
  await page.goto('/admin')
  const popupPromise = page.waitForEvent('popup')
  await page.getByRole('button', { name: /sign in with google/i }).click()
  const popup = await popupPromise
  await popup.waitForLoadState('domcontentloaded')
  // Firebase Auth emulator popup: shows a list of existing accounts (js-reuse-account items)
  // and an "Add new account" button (js-new-account) to create a fresh one.
  const existing = popup.locator('.js-reuse-account').filter({ hasText: email }).first()
  if (await existing.count()) {
    await existing.click()
  } else {
    await popup.locator('.js-new-account').click()
    await popup.locator('#email-input').fill(email)
    await popup.locator('#display-name-input').fill('Admin')
    await popup.locator('#sign-in').click()
  }
  await page.getByRole('heading', { name: /session admin/i }).waitFor()
}

/** Answer every remaining item by clicking the middle radio each time, until the question
 *  screen yields to the sharing prompt (which has no radios). Behaves like the original fixed
 *  32-click pass for a caller starting on item 1, and also stops cleanly when the caller
 *  started part-way through (the auto-join test answers item 1 first), so it never
 *  over-clicks into the sharing prompt. */
export async function answerAll(page: Page) {
  const radio = page.getByRole('radio').nth(2)
  await radio.waitFor({ state: 'visible' })
  for (let i = 0; i < OEJTS_ITEMS.length; i++) {
    if (!(await radio.isVisible().catch(() => false))) break // reached the sharing prompt
    await radio.click()
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
