import { test, expect } from './fixtures/test'
import { seedAdmin, seedSession, seedTaker } from './fixtures/emulator'
import { signInAdmin } from './helpers/flows'

// seedAdmin and seedSession are called inside each test body (after the page fixture's
// clearFirestore has already run — beforeEach runs before fixtures in Playwright).

test('admin Reveal freezes the session and reveals groups (E9, R9)', async ({ page }) => {
  await seedAdmin('admin@x.org')
  await seedSession('s1', { name: 'Fri', timerMinutes: 30 })
  await seedTaker('mae', 's1', { completed: true, type: 'INFJ', seRank: 2, seStrength: 0.4 })

  await signInAdmin(page, 'admin@x.org')
  await page.getByRole('button', { name: /^fri/i }).click()
  await page.getByRole('button', { name: /reveal now/i }).click()
  await expect(page.getByText(/scavenger|games/i).first()).toBeVisible()
  await expect(page.getByText('⚠')).toHaveCount(0)
})

test('admin End sets the session ended (R9)', async ({ page }) => {
  await seedAdmin('admin@x.org')
  await seedSession('s2', { name: 'Sat', timerMinutes: 30 })
  await signInAdmin(page, 'admin@x.org')
  await page.getByRole('button', { name: /^sat/i }).click()
  await page.getByRole('button', { name: /^end$/i }).click()
  await expect(page.getByText(/\(ended\)/i)).toBeVisible()
})

test('roster panel minimizes and closes (E11, R7)', async ({ page }) => {
  await seedAdmin('admin@x.org')
  await seedSession('s3', { name: 'Sun', timerMinutes: 30 })
  await seedTaker('sunbob', 's3')
  await signInAdmin(page, 'admin@x.org')
  await page.getByRole('button', { name: /^sun/i }).click()
  await expect(page.getByText('sunbob')).toBeVisible()
  await page.getByRole('button', { name: /minimize roster/i }).click()
  await expect(page.getByText('sunbob')).toHaveCount(0)
  await page.getByRole('button', { name: /close roster/i }).click()
})

test('admin overrides a taker group (E12, R8)', async ({ page }) => {
  await seedAdmin('admin@x.org')
  await seedSession('s4', { name: 'Mon', timerMinutes: 30 })
  await seedTaker('monkay', 's4')
  await signInAdmin(page, 'admin@x.org')
  await page.getByRole('button', { name: /^mon/i }).click()
  await page.getByRole('button', { name: /move monkay to scavenger/i }).click()
  await expect(page.getByText(/scavenger/i).first()).toBeVisible()
})
