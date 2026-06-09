import { test, expect } from './fixtures/test'
import { seedAdmin, seedSession } from './fixtures/emulator'
import { begin, answerAll, dismissSharing, signInAdmin } from './helpers/flows'

test('taker countdown matches the admin remaining time (E8, R5/R6)', async ({ page, browser }) => {
  await seedAdmin('admin@x.org')
  await seedSession('s1', { name: 'Clock', timerMinutes: 30 })

  const tc = await browser.newContext(); const tp = await tc.newPage()
  await begin(tp, 'timer-tom')
  // Wait for the question screen to load and the session binding to populate the countdown
  await tp.getByLabel(/time remaining/i).waitFor({ timeout: 10_000 })
  const takerText = await tp.getByLabel(/time remaining/i).innerText()
  const takerMin = parseInt(takerText.replace(/\D+/g, ''), 10)

  await signInAdmin(page, 'admin@x.org')
  const adminText = await page.getByText(/min left/i).first().innerText()
  const adminMin = parseInt(adminText.replace(/\D+/g, ''), 10)

  expect(Number.isFinite(takerMin)).toBe(true)
  expect(Number.isFinite(adminMin)).toBe(true)
  expect(Math.abs(takerMin - adminMin)).toBeLessThanOrEqual(1) // lockstep within a tick
  await tc.close()
})

test('fresh 30-min session shows countdown, never an early group (E14, R11)', async ({ page }) => {
  await seedSession('s2', { name: 'NoReveal', timerMinutes: 30 })
  await begin(page, 'fresh-fae')
  await answerAll(page); await dismissSharing(page)
  await expect(page.getByText(/check back in/i)).toBeVisible()
  await expect(page.getByText(/group!/i)).toHaveCount(0)
})
