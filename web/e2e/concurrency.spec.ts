import { test, expect } from './fixtures/test'
import { clearFirestore, seedSession } from './fixtures/emulator'
import { begin, answerAll } from './helpers/flows'

test('Simultaneous takers: sharers see each other live; a private one is hidden', async ({ browser }) => {
  await clearFirestore()
  await seedSession('live', { name: 'Live', timerMinutes: 30 })

  const ctxs = await Promise.all([0, 1, 2].map(() => browser.newContext()))
  const [pA, pB, pC] = await Promise.all(ctxs.map((c) => c.newPage()))

  await test.step('Given three takers begin in the same session at once', async () => {
    await Promise.all([begin(pA, 'amy'), begin(pB, 'ben'), begin(pC, 'cat')])
    await Promise.all([answerAll(pA), answerAll(pB), answerAll(pC)])
  })
  await test.step('When amy and ben share but cat stays private', async () => {
    await pA.getByRole('button', { name: /yes, share/i }).click()
    await pB.getByRole('button', { name: /yes, share/i }).click()
    await pC.getByRole('button', { name: /no, keep private/i }).click()
  })
  await test.step('Then amy and ben see each other live; cat appears to nobody', async () => {
    await expect(pA.getByText(/\bben\b/i)).toBeVisible()
    await expect(pB.getByText(/\bamy\b/i)).toBeVisible()
    await expect(pA.getByText(/\bcat\b/i)).toHaveCount(0)
    await expect(pB.getByText(/\bcat\b/i)).toHaveCount(0)
  })
  await Promise.all(ctxs.map((c) => c.close()))
})
