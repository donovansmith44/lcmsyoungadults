import { test, expect } from './fixtures/test'
import { seedSession, updateSeededDoc, deleteSeededDoc } from './fixtures/emulator'
import { begin, answerAll } from './helpers/flows'

test('Session ended under a sharing taker shows "your session has ended"', async ({ page }) => {
  await test.step('Given a sharing taker on the result screen of an active session', async () => {
    await seedSession('se1', { name: 'Day', timerMinutes: 30 })
    await begin(page, 'ended-eli')
    await answerAll(page)
    await page.getByRole('button', { name: /yes, share/i }).click()
    await expect(page.getByText(/shared in this session/i)).toBeVisible() // list visible while active
  })
  await test.step('When the admin ends the session', async () => {
    await updateSeededDoc('sessions/se1', { status: 'ended', endedAt: new Date() })
  })
  await test.step('Then the list is replaced by the ended message and the result still shows', async () => {
    await expect(page.getByText(/your session has ended/i)).toBeVisible()
    await expect(page.getByText(/your answers point to/i)).toBeVisible()
  })
})

test('Session deleted under a sharing taker shows the ended message', async ({ page }) => {
  await seedSession('se2', { name: 'Day', timerMinutes: 30 })
  await begin(page, 'gone-gus')
  await answerAll(page)
  await page.getByRole('button', { name: /yes, share/i }).click()
  await expect(page.getByText(/shared in this session/i)).toBeVisible()
  await deleteSeededDoc('sessions/se2')
  await expect(page.getByText(/your session has ended/i)).toBeVisible()
})
