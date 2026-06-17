import { test, expect } from './fixtures/test'
import { seedSession, seedTaker, updateSeededDoc, deleteSeededDoc } from './fixtures/emulator'
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

test('A taker sees only their own session\'s sharers, never another session\'s', async ({ page }) => {
  await test.step('Given session A and session B each with a sharer', async () => {
    await seedSession('A', { name: 'A', timerMinutes: 30 })
    // B is seeded ended so two active sessions never coexist; visibility is by sessionId.
    await seedSession('B', { name: 'B', timerMinutes: 30, status: 'ended' })
    await seedTaker('alice-A', 'A', { type: 'INTJ' })
    await updateSeededDoc('takers/alice-A', { sharing: true })
    await seedTaker('bob-B', 'B', { type: 'ESFP' })
    await updateSeededDoc('takers/bob-B', { sharing: true })
  })
  await test.step('When a new taker joins (active) session A and shares', async () => {
    await begin(page, 'carol-A')
    await answerAll(page)
    await page.getByRole('button', { name: /yes, share/i }).click()
  })
  await test.step('Then they see A\'s sharer but never B\'s', async () => {
    await expect(page.getByText(/alice-A/i)).toBeVisible()
    await expect(page.getByText(/bob-B/i)).toHaveCount(0)
  })
})

test('Lifecycle: delete A, create B; B cannot see A', async ({ page }) => {
  await test.step('Given session A with a sharer, then A is deleted', async () => {
    await seedSession('lifeA', { name: 'A', timerMinutes: 30 })
    await seedTaker('ann-A', 'lifeA', { type: 'INFP' })
    await updateSeededDoc('takers/ann-A', { sharing: true })
    await deleteSeededDoc('sessions/lifeA')
    await deleteSeededDoc('meta/activeSession')
  })
  await test.step('When session B opens and a taker shares', async () => {
    await seedSession('lifeB', { name: 'B', timerMinutes: 30 })
    await begin(page, 'ben-B')
    await answerAll(page)
    await page.getByRole('button', { name: /yes, share/i }).click()
  })
  await test.step('Then B\'s taker sees only B, never the deleted A\'s sharer', async () => {
    await expect(page.getByText(/shared in this session/i)).toBeVisible()
    await expect(page.getByText(/ann-A/i)).toHaveCount(0)
  })
})

test('No active session at Begin: taker stays private with no list', async ({ page }) => {
  // No seedSession → getActiveSession returns null → taker is session-less.
  await begin(page, 'lonely-lou')
  await answerAll(page)
  await page.getByRole('button', { name: /no, keep private/i }).click()
  await expect(page.getByText(/your answers point to/i)).toBeVisible()
  await expect(page.getByRole('checkbox')).toBeEnabled()
  await expect(page.getByText(/shared in this session/i)).toHaveCount(0) // no shared-list region
})
