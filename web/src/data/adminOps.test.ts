import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { getTestEnv } from '../../test/emulator'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { setTakerGroupOverride, recomputeSessionGroups } from './adminOps'

describe('adminOps (emulator)', () => {
  beforeEach(async () => { (await getTestEnv()).clearFirestore() })
  afterAll(async () => { await (await getTestEnv()).cleanup() })

  it('override pins a taker and marks groupOverride', async () => {
    const env = await getTestEnv()
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await setDoc(doc(db, 'takers', 'x'), { username: 'x', group: 'games', groupOverride: false })
      await setTakerGroupOverride(db, 'x', 'scavenger')
      const t = (await getDoc(doc(db, 'takers', 'x'))).data()!
      expect(t.group).toBe('scavenger')
      expect(t.groupOverride).toBe(true)
    })
  })

  it('recompute re-splits completed takers but keeps overrides', async () => {
    const env = await getTestEnv()
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await setDoc(doc(db, 'sessions', 's1'), { status: 'active', timerMinutes: 30, groupsFrozenAt: 1 })
      const mk = (id: string, seRank: number, extra = {}) =>
        setDoc(doc(db, 'takers', id), { username: id, sessionId: 's1', completed: true, seRank, seStrength: 0, group: null, groupOverride: false, ...extra })
      await mk('a', 1)
      await mk('b', 2)
      await mk('pinned', 1, { group: 'games', groupOverride: true })
      await recomputeSessionGroups(db, 's1')
      const grp = async (id: string) => (await getDoc(doc(db, 'takers', id))).data()!.group
      expect(await grp('pinned')).toBe('games') // untouched
      expect(['scavenger', 'games']).toContain(await grp('a'))
      expect(['scavenger', 'games']).toContain(await grp('b'))
    })
  })
})
