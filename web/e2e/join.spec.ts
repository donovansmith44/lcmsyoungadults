import { test, expect } from './fixtures/test'
import { clearFirestore, seedSession } from './fixtures/emulator'
import { begin, answerAll } from './helpers/flows'

test('Auto-join: a mid-test session-less taker is bound when a session starts', async ({ page }) => {
  await clearFirestore() // no active session at Begin
  await test.step('Given a taker begins with no active session and answers one question', async () => {
    await begin(page, 'early-eve')
    await page.getByRole('radio').nth(2).click()
    await expect(page.getByText('2 / 32')).toBeVisible()
  })
  await test.step('When a session starts mid-test', async () => {
    await seedSession('mid', { name: 'Mid', timerMinutes: 30 })
  })
  await test.step('Then finishing and sharing puts them in that session\'s list', async () => {
    await answerAll(page) // answers remaining items
    await page.getByRole('button', { name: /yes, share/i }).click()
    await expect(page.getByText(/shared in this session/i)).toBeVisible() // bound + sharing => list region
  })
})

test('Opt-in join: a finished session-less taker can join a later session', async ({ page }) => {
  await clearFirestore()
  await test.step('Given a taker finishes with no active session (private)', async () => {
    await begin(page, 'done-dan')
    await answerAll(page)
    await page.getByRole('button', { name: /no, keep private/i }).click()
    await expect(page.getByText(/your answers point to/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /join this session/i })).toHaveCount(0)
  })
  await test.step('When a session starts, Then a Join button appears; tapping it lets them share', async () => {
    await seedSession('later', { name: 'Later', timerMinutes: 30 })
    await page.getByRole('button', { name: /join this session/i }).click()
    await page.getByRole('checkbox').click() // click, not check(): React-controlled checkbox backed by async Firestore
    await expect(page.getByText(/shared in this session/i)).toBeVisible()
  })
})
