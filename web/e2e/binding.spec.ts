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
  // Wait until early-eli is actually on the test (begin's async bind has resolved with NO
  // active session) BEFORE the session starts — otherwise we'd race the bind against the seed.
  await expect(tp.getByText('1 / 32')).toBeVisible()
  await seedSession('sLate', { name: 'Late', timerMinutes: 30 })   // session begins after they started
  await answerAll(tp); await dismissSharing(tp)
  await expect(tp.getByText(/your answers point to/i)).toBeVisible() // they see their OWN result
  await tc.close()

  // A SECOND taker who began AFTER the session started — genuinely a member of 'Late'.
  const tc2 = await browser.newContext(); const tp2 = await tc2.newPage()
  await begin(tp2, 'late-len')
  await expect(tp2.getByText(/late/i)).toBeVisible()              // bound to 'Late'

  await signInAdmin(page, 'admin@x.org')
  await page.getByRole('button', { name: /^late/i }).click()
  // Anchor on the genuine member so the roster has definitely loaded its real members
  // before we assert the pre-session taker is absent (no vacuous toHaveCount(0)).
  await expect(page.getByText('late-len')).toBeVisible()         // the real member IS present
  await expect(page.getByText('early-eli')).toHaveCount(0)       // the pre-session taker is NOT
  await tc2.close()
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
