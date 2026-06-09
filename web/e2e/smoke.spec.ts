import { test, expect } from './fixtures/test'
import { begin, answerAll, dismissSharing } from './helpers/flows'

test('taker can complete the test and see a type', async ({ page }) => {
  await begin(page, 'smoke-mae')
  await answerAll(page)
  await dismissSharing(page)
  await expect(page.getByText(/your answers point to/i)).toBeVisible()
})
