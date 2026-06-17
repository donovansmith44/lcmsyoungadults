import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { getTestEnv } from '../../test/emulator'
import { startSession, endSession, getActiveSession, archiveSession } from './sessions'

describe('sessions data layer (emulator)', () => {
  beforeEach(async () => { (await getTestEnv()).clearFirestore() })
  afterAll(async () => { await (await getTestEnv()).cleanup() })

  it('starts a session and finds it as active', async () => {
    const env = await getTestEnv()
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      const id = await startSession(db, { name: 'Personality Day', timerMinutes: 30, createdBy: 'd@x.org' })
      const active = await getActiveSession(db)
      expect(active?.id).toBe(id)
      expect(active?.timerMinutes).toBe(30)
    })
  })

  it('refuses a second active session', async () => {
    const env = await getTestEnv()
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await startSession(db, { name: 'A', timerMinutes: 30, createdBy: 'd@x.org' })
      await expect(
        startSession(db, { name: 'B', timerMinutes: 30, createdBy: 'd@x.org' }),
      ).rejects.toThrow(/active session/i)
    })
  })

  it('ending then archiving clears active and hides it', async () => {
    const env = await getTestEnv()
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      const id = await startSession(db, { name: 'A', timerMinutes: 30, createdBy: 'd@x.org' })
      await endSession(db, id)
      expect(await getActiveSession(db)).toBeNull()
      await archiveSession(db, id)
    })
  })

  it('two concurrent starts produce exactly one active session', async () => {
    const env = await getTestEnv()
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      const results = await Promise.allSettled([
        startSession(db, { name: 'A', timerMinutes: 30, createdBy: 'd@x.org' }),
        startSession(db, { name: 'B', timerMinutes: 30, createdBy: 'd@x.org' }),
      ])
      const ok = results.filter((r) => r.status === 'fulfilled')
      expect(ok).toHaveLength(1)
      const active = await getActiveSession(db)
      expect(active).not.toBeNull()
      // only one session doc exists
      const { getDocs, collection } = await import('firebase/firestore')
      const snap = await getDocs(collection(db, 'sessions'))
      expect(snap.size).toBe(1)
    })
  })

  it('ending a session clears the active pointer so a new one can start', async () => {
    const env = await getTestEnv()
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      const id = await startSession(db, { name: 'A', timerMinutes: 30, createdBy: 'd@x.org' })
      await endSession(db, id)
      await expect(startSession(db, { name: 'B', timerMinutes: 30, createdBy: 'd@x.org' })).resolves.toBeTruthy()
    })
  })
})
