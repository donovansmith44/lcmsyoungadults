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

test('Given /, Then the under-construction home shows (not the test)', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText(/under construction/i)).toBeVisible()
  await expect(page.getByText('1 / 32')).toHaveCount(0) // not the test
  await expect(page.getByPlaceholder(/username/i)).toHaveCount(0)
})

test('Given an unknown path, Then it redirects to the home (under construction)', async ({ page }) => {
  await page.goto('/nope/does-not-exist')
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByText(/under construction/i)).toBeVisible()
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
