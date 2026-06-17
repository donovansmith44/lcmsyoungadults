import { test, expect } from './fixtures/test'
import { begin, answerAll, dismissSharing } from './helpers/flows'

test('Given /personality, When visited, Then it redirects to /personality-test', async ({ page }) => {
  await test.step('Given the alias path, When navigating', async () => {
    await page.goto('/personality')
  })
  await test.step('Then the URL resolves to the canonical test path', async () => {
    await expect(page).toHaveURL(/\/personality-test$/)
    await expect(page.getByRole('heading', { name: /personality test/i })).toBeVisible()
  })
})

test('Given an unknown path, Then it redirects to the test', async ({ page }) => {
  await page.goto('/nope/does-not-exist')
  await expect(page).toHaveURL(/\/personality-test$/)
})

test('Given the taker flow, Then it progresses landing → questions → result', async ({ page }) => {
  await test.step('Given /personality-test, When a name is entered and Begin clicked', async () => {
    await begin(page, 'route-rita')
  })
  await test.step('Then the question flow shows', async () => {
    await expect(page.getByText('1 / 32')).toBeVisible()
  })
  await test.step('When all 32 are answered and sharing dismissed, Then the result shows', async () => {
    await answerAll(page)
    await dismissSharing(page)
    await expect(page.getByText(/your answers point to/i)).toBeVisible()
  })
})
