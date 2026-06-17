import { test, expect } from './fixtures/test'
import { seedAdmin, seedSession } from './fixtures/emulator'
import { signInAdmin } from './helpers/flows'

test('Allowlisted admin can sign in and start a session', async ({ page }) => {
  await seedAdmin('donovan.smith44@gmail.com')
  await signInAdmin(page, 'donovan.smith44@gmail.com')
  await page.getByPlaceholder(/session name/i).fill('Day One')
  await page.getByRole('button', { name: /start session/i }).click()
  await expect(page.getByText(/Day One/).first()).toBeVisible()
})

test('Start is blocked while a session is already active', async ({ page }) => {
  await seedAdmin('donovan.smith44@gmail.com')
  await seedSession('act1', { name: 'Already Active', timerMinutes: 30 })
  await signInAdmin(page, 'donovan.smith44@gmail.com')
  await page.getByPlaceholder(/session name/i).fill('Second')
  await expect(page.getByRole('button', { name: /start session/i })).toBeDisabled()
  await expect(page.getByText(/end the active session before starting another/i)).toBeVisible()
})

test('Non-allowlisted Google user is denied the admin console', async ({ page }) => {
  // No seedAdmin for this email → not in allowlist.
  await page.goto('/admin')
  const popupPromise = page.waitForEvent('popup')
  await page.getByRole('button', { name: /sign in with google/i }).click()
  const popup = await popupPromise
  await popup.waitForLoadState('domcontentloaded')
  await popup.locator('.js-new-account').waitFor()
  await popup.locator('.js-new-account').click()
  await popup.locator('#email-input').fill('stranger@gmail.com')
  await popup.locator('#display-name-input').fill('Stranger')
  await popup.locator('#sign-in').click()
  await popup.waitForEvent('close')
  await expect(page.getByRole('heading', { name: /session admin/i })).toHaveCount(0)
})

test('Delete requires typing DELETE exactly', async ({ page }) => {
  await seedAdmin('donovan.smith44@gmail.com')
  await seedSession('del1', { name: 'To Delete', timerMinutes: 30, status: 'ended' })
  await signInAdmin(page, 'donovan.smith44@gmail.com')
  // Click the Delete button for this session
  await page.getByRole('button', { name: /^delete$/i }).first().click()
  // Scope to the DeleteConfirm modal card (the one containing the "Type DELETE" prompt)
  // so selectors are semantic rather than positional — avoids drift if other inputs/buttons
  // are added to the page.
  const modal = page.locator('.card').filter({ hasText: /type .*delete.* and press the button/i })
  const field = modal.getByRole('textbox')
  const confirm = modal.getByRole('button', { name: /^delete$/i })
  // Wrong value does not delete — DeleteConfirm disables the confirm button when text !== 'DELETE'
  await field.fill('nope')
  await expect(confirm).toBeDisabled()
  // 'To Delete' session name still visible
  await expect(page.getByText(/To Delete/).first()).toBeVisible()
  // Correct value enables and deletes
  await field.fill('DELETE')
  await confirm.click()
  await expect(page.getByText(/To Delete/)).toHaveCount(0)
})
