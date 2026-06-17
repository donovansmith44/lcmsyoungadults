import { test, expect } from './fixtures/test'
import { seedSession } from './fixtures/emulator'
import { begin, answerAll } from './helpers/flows'

test('Share path: list shown and toggle locked on', async ({ page }) => {
  await test.step('Given an active session and a taker who answers all 32', async () => {
    await seedSession('sx', { name: 'Day', timerMinutes: 30 })
    await begin(page, 'share-sara')
    await answerAll(page)
  })
  await test.step('When they choose to share', async () => {
    await page.getByRole('button', { name: /yes, share/i }).click()
  })
  await test.step('Then they see the participant list and cannot un-share', async () => {
    await expect(page.getByText(/your answers point to/i)).toBeVisible()
    await expect(page.getByText(/shared in this session/i)).toBeVisible() // shared-list region present
    await expect(page.getByRole('checkbox')).toBeDisabled()
  })
})

test('Private path: no list, toggle available; enabling it reveals list and locks', async ({ page }) => {
  await test.step('Given a taker who chooses not to share', async () => {
    await seedSession('sy', { name: 'Day', timerMinutes: 30 })
    await begin(page, 'priv-pat')
    await answerAll(page)
    await page.getByRole('button', { name: /no, keep private/i }).click()
  })
  await test.step('Then no list shows and the toggle is enabled', async () => {
    await expect(page.getByText(/your answers point to/i)).toBeVisible()
    await expect(page.getByText(/shared in this session/i)).toHaveCount(0)
    await expect(page.getByRole('checkbox')).toBeEnabled()
  })
  await test.step('When they toggle sharing on, Then the list appears and the toggle locks', async () => {
    await page.getByRole('checkbox').click()
    await expect(page.getByText(/shared in this session/i)).toBeVisible()
    await expect(page.getByRole('checkbox')).toBeDisabled()
  })
})
