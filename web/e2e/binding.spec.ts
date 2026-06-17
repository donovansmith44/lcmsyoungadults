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

test('a taker who FINISHED before any session stays private — not auto-joined into a later session (E5, R3)', async ({ page, browser }) => {
  // Late-join (design §4.7): auto-join silently binds a STILL-TESTING session-less taker when
  // a session starts (covered positively in join.spec.ts). A taker who already COMPLETED while
  // session-less is NOT auto-joined — they stay private unless they opt in via "Join this
  // session". This test pins that invariant: finish first, THEN a session starts.
  await seedAdmin('admin@x.org')
  // NO active session yet
  const tc = await browser.newContext(); const tp = await tc.newPage()
  await begin(tp, 'early-eli')
  await expect(tp.getByText('1 / 32')).toBeVisible()
  await answerAll(tp); await dismissSharing(tp)
  await expect(tp.getByText(/your answers point to/i)).toBeVisible() // finished, session-less
  await seedSession('sLate', { name: 'Late', timerMinutes: 30 })     // session begins AFTER they finished
  await tc.close()                                                   // they never opt in to join

  // A SECOND taker who began AFTER the session started — genuinely a member of 'Late'.
  const tc2 = await browser.newContext(); const tp2 = await tc2.newPage()
  await begin(tp2, 'late-len')
  await expect(tp2.getByText(/late/i)).toBeVisible()              // bound to 'Late'

  await signInAdmin(page, 'admin@x.org')
  await page.getByRole('button', { name: /^late/i }).click()
  // Anchor on the genuine member so the roster has definitely loaded its real members
  // before we assert the finished pre-session taker is absent (no vacuous toHaveCount(0)).
  await expect(page.getByText('late-len')).toBeVisible()         // the real member IS present
  await expect(page.getByText('early-eli')).toHaveCount(0)       // the finished pre-session taker is NOT auto-joined
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
