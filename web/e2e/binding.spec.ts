import { test, expect } from './fixtures/test'
import { seedAdmin, seedSession } from './fixtures/emulator'
import { begin, answerAll, dismissSharing, signInAdmin } from './helpers/flows'

test('a taker is bound to the session active at begin and shows its name (E6, R3/R5)', async ({ page, browser }) => {
  await seedAdmin('admin@x.org')
  await seedSession('sA', { name: 'Alpha', timerMinutes: 30 })

  const tc = await browser.newContext(); const tp = await tc.newPage()
  await begin(tp, 'join-jan')
  await expect(tp.getByText(/alpha/i)).toBeVisible()          // session name shown (R5)
  await answerAll(tp); await dismissSharing(tp)
  await tc.close()

  await signInAdmin(page, 'admin@x.org')
  await page.getByRole('button', { name: /^alpha/i }).click()
  await expect(page.getByText('join-jan')).toBeVisible()       // bound -> in the roster (R3)
})

test('a pre-session taker stays private — not recorded into a later session (E5, R3)', async ({ page, browser }) => {
  await seedAdmin('admin@x.org')
  // NO active session yet
  const tc = await browser.newContext(); const tp = await tc.newPage()
  await begin(tp, 'early-eli')
  await seedSession('sLate', { name: 'Late', timerMinutes: 30 })   // session begins mid-test
  await answerAll(tp); await dismissSharing(tp)
  await expect(tp.getByText(/your answers point to/i)).toBeVisible() // they see their OWN result
  await tc.close()

  await signInAdmin(page, 'admin@x.org')
  await page.getByRole('button', { name: /^late/i }).click()
  await expect(page.getByText('early-eli')).toHaveCount(0)     // NOT in the late session's roster
})

test('an unfinished participant sees their group after admin reveal (E7, R4)', async ({ page, browser }) => {
  await seedAdmin('admin@x.org')
  await seedSession('sB', { name: 'Beta', timerMinutes: 30 })

  const tc = await browser.newContext(); const tp = await tc.newPage()
  await begin(tp, 'slow-sue')
  await tp.getByRole('radio').nth(2).click()   // answer one, do NOT finish
  await tp.waitForTimeout(300)

  await signInAdmin(page, 'admin@x.org')
  await page.getByRole('button', { name: /^beta/i }).click()
  await page.getByRole('button', { name: /reveal now/i }).click()

  // the still-open taker page receives the freeze + their assigned group
  await expect(tp.getByTestId('reveal-banner')).toBeVisible({ timeout: 10000 })
  await tc.close()
})
