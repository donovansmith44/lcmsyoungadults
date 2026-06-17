import { test, expect } from './fixtures/test'
import { seedSession } from './fixtures/emulator'
import { begin } from './helpers/flows'

test('question text is brand teal with AA contrast on mobile (R10)', async ({ page }) => {
  await seedSession('sm', { name: 'Mobile', timerMinutes: 30 })
  await begin(page, 'mobile-mo')
  const h = page.getByRole('heading', { level: 2 })
  await expect(h).toBeVisible()
  const color = await h.evaluate((el) => getComputedStyle(el).color)
  expect(color).toBe('rgb(1, 64, 79)') // --teal #01404f
  const ratio = await h.evaluate((el) => {
    const lum = (c: string) => {
      const [r, g, b] = c.match(/\d+/g)!.map(Number).map((v) => {
        const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const fg = lum(getComputedStyle(el).color)
    let node: HTMLElement | null = el as HTMLElement, bg = 'rgb(255,255,255)'
    while (node) { const c = getComputedStyle(node).backgroundColor; if (c && c !== 'rgba(0, 0, 0, 0)') { bg = c; break } node = node.parentElement }
    const bl = lum(bg)
    const [a, b] = [fg, bl].sort((x, y) => y - x)
    return (a + 0.05) / (b + 0.05)
  })
  expect(ratio).toBeGreaterThanOrEqual(4.5)
})

test('landing header is brand teal, not a washed-out default (R10)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }) // iPhone 12-ish
  await page.goto('/personality-test')
  const h1 = page.getByRole('heading', { name: /personality test/i })
  await expect(h1).toBeVisible()
  const color = await h1.evaluate((el) => getComputedStyle(el).color)
  // var(--teal) #01404f === rgb(1, 64, 79)
  expect(color).toBe('rgb(1, 64, 79)')
})
