import { test, expect } from './fixtures/test'
import { clearFirestore, seedSession } from './fixtures/emulator'
import { begin, answerAll, dismissSharing } from './helpers/flows'

test('resume on refresh keeps progress (E2)', async ({ page }) => {
  await begin(page, 'resume-sam')
  await page.getByRole('radio').nth(2).click()
  await page.waitForTimeout(300)
  await expect(page.getByText('2 / 32')).toBeVisible() // advanced past Q1
  await page.reload()
  await expect(page.getByText('2 / 32')).toBeVisible() // resumed where left off
})

test('start over returns to landing for a new alias (E3)', async ({ page }) => {
  await begin(page, 'over-amy')
  await answerAll(page)
  await dismissSharing(page)
  await expect(page.getByText(/your answers point to/i)).toBeVisible()
  await page.getByRole('button', { name: /start over/i }).click()
  await expect(page.getByPlaceholder(/username/i)).toBeVisible()
  await begin(page, 'over-amy-2')
  await expect(page.getByText('1 / 32')).toBeVisible()
})

test('same alias in a different browser is refused and shows no history (E4)', async ({ browser }) => {
  await clearFirestore()
  await seedSession('dup', { name: 'Dup', timerMinutes: 30 }) // uniqueness is scoped to a running session
  const c1 = await browser.newContext(); const p1 = await c1.newPage()
  await begin(p1, 'dupe-jo')
  await p1.getByRole('radio').nth(2).click()
  await p1.waitForTimeout(300)
  await expect(p1.getByText('2 / 32')).toBeVisible()

  const c2 = await browser.newContext(); const p2 = await c2.newPage() // a different "device"
  await begin(p2, 'dupe-jo')
  await expect(p2.getByText(/taken/i)).toBeVisible()       // claim refused
  await expect(p2.getByText('2 / 32')).toHaveCount(0)      // did NOT inherit p1's progress
  await c1.close(); await c2.close()
})

test('Given a taken name on another device, Then begin shows "taken" (E4-msg)', async ({ browser }) => {
  await clearFirestore()
  await seedSession('uniq', { name: 'Uniq', timerMinutes: 30 })
  const c1 = await browser.newContext(); const p1 = await c1.newPage()
  await begin(p1, 'uniq-uma')
  await expect(p1.getByText('1 / 32')).toBeVisible()

  const c2 = await browser.newContext(); const p2 = await c2.newPage()
  await begin(p2, 'uniq-uma')
  await expect(p2.getByText(/taken/i)).toBeVisible()
  await c1.close(); await c2.close()
})

test('Given two devices racing the same fresh name, Then exactly one is admitted', async ({ browser }) => {
  await clearFirestore()
  await seedSession('race', { name: 'Race', timerMinutes: 30 })
  const c1 = await browser.newContext(); const p1 = await c1.newPage()
  const c2 = await browser.newContext(); const p2 = await c2.newPage()
  await Promise.all([begin(p1, 'race-rae'), begin(p2, 'race-rae')])

  // Wait for each page to settle to one of the two outcomes before counting.
  await Promise.all([p1, p2].map((p) =>
    expect(p.getByText(/1 \/ 32|taken/i).first()).toBeVisible({ timeout: 10000 })
  ))

  // One page shows the question flow; the other shows the taken error.
  const admitted = [p1, p2].map((p) => p.getByText('1 / 32'))
  const refused = [p1, p2].map((p) => p.getByText(/taken/i))
  const okCount = (await Promise.all(admitted.map((l) => l.count()))).reduce((a, b) => a + b, 0)
  const noCount = (await Promise.all(refused.map((l) => l.count()))).reduce((a, b) => a + b, 0)
  expect(okCount).toBe(1)
  expect(noCount).toBe(1)
  await c1.close(); await c2.close()
})

test('Without an active session, a stale name is reclaimable (not taken forever)', async ({ browser }) => {
  await clearFirestore() // NO active session
  const c1 = await browser.newContext(); const p1 = await c1.newPage()
  await begin(p1, 'reuse-ray')
  await expect(p1.getByText('1 / 32')).toBeVisible()
  await c1.close() // device 1 leaves

  const c2 = await browser.newContext(); const p2 = await c2.newPage()
  await begin(p2, 'reuse-ray') // same name, different device, no session running
  await expect(p2.getByText('1 / 32')).toBeVisible()   // reclaimed — reaches the test
  await expect(p2.getByText(/taken/i)).toHaveCount(0)  // NOT refused
  await c2.close()
})
