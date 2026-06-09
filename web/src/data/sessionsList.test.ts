import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { getTestEnv } from '../../test/emulator'
import { collection, doc, getDocs, orderBy, query, setDoc } from 'firebase/firestore'

// Reproduces the "already an active session when I don't see one" bug: an active
// session with no `startedAt` is invisible to an orderBy('startedAt') query (what
// useSessions used to do) yet still exists — so the admin list hid it while
// getActiveSession kept blocking new sessions. The admin list now reads the whole
// collection (no orderBy), which keeps such sessions visible.
describe('sessions listing (emulator)', () => {
  beforeEach(async () => { (await getTestEnv()).clearFirestore() })
  afterAll(async () => { await (await getTestEnv()).cleanup() })

  it('an active session with no startedAt is hidden by orderBy but kept by a plain read', async () => {
    const env = await getTestEnv()
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await setDoc(doc(db, 'sessions', 'normal'), { name: 'normal', status: 'ended', startedAt: 1000 })
      await setDoc(doc(db, 'sessions', 'orphan'), { name: 'orphan', status: 'active' }) // no startedAt

      // OLD behavior (orderBy) silently drops the orphan -> it goes invisible
      const ordered = await getDocs(query(collection(db, 'sessions'), orderBy('startedAt', 'desc')))
      expect(ordered.docs.map((d) => d.id)).toEqual(['normal'])

      // NEW behavior (plain collection read, what useSessions does) keeps BOTH
      const all = await getDocs(collection(db, 'sessions'))
      expect(all.docs.map((d) => d.id).sort()).toEqual(['normal', 'orphan'])
    })
  })
})
