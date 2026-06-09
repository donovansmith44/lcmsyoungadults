import { test as base } from '@playwright/test'
import { clearFirestore } from './emulator'

export const test = base.extend({
  page: async ({ page }, use) => {
    await clearFirestore()
    await use(page)
  },
})
export { expect } from '@playwright/test'
