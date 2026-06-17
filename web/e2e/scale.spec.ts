import { test, expect } from './fixtures/test'
import { clearFirestore, seedSession, seedTaker, updateSeededDoc } from './fixtures/emulator'
import { begin, answerAll } from './helpers/flows'

test('30+ takers in mixed states: a live actor sees exactly the completed+shared of its session', async ({ browser }) => {
  test.setTimeout(60_000)
  await clearFirestore()
  await seedSession('big', { name: 'Big', timerMinutes: 30 })
  await seedSession('other', { name: 'Other', timerMinutes: 30, status: 'ended' })

  const sharedNames: string[] = []
  await test.step('Given a ~36-person crowd in assorted states', async () => {
    const jobs: Promise<unknown>[] = []
    for (let i = 0; i < 36; i++) {
      const name = `crowd-${i}`
      if (i % 3 === 0) {
        // completed + shared
        jobs.push(seedTaker(name, 'big', { type: 'INFJ' }).then(() => updateSeededDoc(`takers/${name}`, { sharing: true })))
        sharedNames.push(name)
      } else if (i % 3 === 1) {
        // completed + private
        jobs.push(seedTaker(name, 'big', { type: 'ESTP' }))
      } else {
        // still testing (not completed)
        jobs.push(seedTaker(name, 'big', { completed: false, type: 'INTP' }))
      }
    }
    // plus a few in the OTHER session, shared — must never appear
    jobs.push(seedTaker('other-1', 'other', { type: 'ENFP' }).then(() => updateSeededDoc('takers/other-1', { sharing: true })))
    await Promise.all(jobs)
  })

  await test.step('When a live actor joins the big session and shares', async () => {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await begin(page, 'live-liz')
    await answerAll(page)
    await page.getByRole('button', { name: /yes, share/i }).click()

    await test.step('Then they see every shared crowd member, none of the private/testing, and nobody from the other session', async () => {
      for (const n of sharedNames) await expect(page.getByText(new RegExp(`\\b${n}\\b`))).toBeVisible()
      await expect(page.getByText(/\bcrowd-1\b/)).toHaveCount(0)   // private
      await expect(page.getByText(/\bcrowd-2\b/)).toHaveCount(0)   // still testing
      await expect(page.getByText(/other-1/)).toHaveCount(0)       // other session
    })
    await ctx.close()
  })
})
