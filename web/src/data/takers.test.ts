import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { getTestEnv } from '../../test/emulator'
import { getDoc, doc } from 'firebase/firestore'
import { upsertTaker, recordAnswer, completeTaker, normalizeUsername, UsernameTakenError, setSharing, getTaker, joinSession } from './takers'

describe('takers data layer (emulator)', () => {
  beforeEach(async () => { (await getTestEnv()).clearFirestore() })
  afterAll(async () => { await (await getTestEnv()).cleanup() })

  it('normalizes usernames to a stable key', () => {
    expect(normalizeUsername('  Donovan ')).toBe('donovan')
  })

  it('creates then resumes a taker by username', async () => {
    const env = await getTestEnv()
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await upsertTaker(db, 'Donovan', { ownerUid: 'u', sessionId: null })
      await recordAnswer(db, 'Donovan', 4, 5)
      const snap = await getDoc(doc(db, 'takers', 'donovan'))
      expect(snap.exists()).toBe(true)
      expect(snap.data()!.username).toBe('Donovan')
      expect(snap.data()!.answers['4']).toBe(5)
      expect(snap.data()!.completed).toBe(false)
    })
  })

  it('completing a taker stamps type, axisScores, seRank', async () => {
    const env = await getTestEnv()
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await upsertTaker(db, 'Mae', { ownerUid: 'u', sessionId: null })
      await completeTaker(db, 'Mae', {
        type: 'ESTP', axisScores: { IE: 40, SN: 8, TF: 12, JP: 30 }, seRank: 1, seStrength: 32,
      })
      const snap = await getDoc(doc(db, 'takers', 'mae'))
      expect(snap.data()!.completed).toBe(true)
      expect(snap.data()!.type).toBe('ESTP')
      expect(snap.data()!.seRank).toBe(1)
    })
  })

  it('records ownerUid and the joined session on create', async () => {
    const env = await getTestEnv()
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await upsertTaker(db, 'Donovan', { ownerUid: 'uidA', sessionId: 'sX' })
      const snap = await getDoc(doc(db, 'takers', 'donovan'))
      expect(snap.data()!.ownerUid).toBe('uidA')
      expect(snap.data()!.sessionId).toBe('sX')
    })
  })

  it('resumes silently when the same owner re-claims the name', async () => {
    const env = await getTestEnv()
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await upsertTaker(db, 'Mae', { ownerUid: 'uidA', sessionId: null })
      await upsertTaker(db, 'Mae', { ownerUid: 'uidA', sessionId: 'sLater' })
      const snap = await getDoc(doc(db, 'takers', 'mae'))
      expect(snap.data()!.sessionId).toBe(null) // joined session is immutable
    })
  })

  it('throws UsernameTakenError when a different owner claims the name', async () => {
    const env = await getTestEnv()
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await upsertTaker(db, 'Sam', { ownerUid: 'uidA', sessionId: null })
      await expect(upsertTaker(db, 'Sam', { ownerUid: 'uidB', sessionId: null }))
        .rejects.toBeInstanceOf(UsernameTakenError)
    })
  })

  it('setSharing cannot turn sharing back off once enabled', async () => {
    const env = await getTestEnv()
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await upsertTaker(db, 'lockme', { ownerUid: 'u1', sessionId: 's1' })
      await setSharing(db, 'lockme', true)
      await expect(setSharing(db, 'lockme', false)).rejects.toThrow(/can.?t.*stop sharing|locked/i)
      expect((await getTaker(db, 'lockme'))?.sharing).toBe(true)
    })
  })

  it('joinSession binds a session-less taker, and never hops an already-bound one', async () => {
    const env = await getTestEnv()
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await upsertTaker(db, 'joiner', { ownerUid: 'u1', sessionId: null })
      await joinSession(db, 'joiner', 'S1')
      expect((await getTaker(db, 'joiner'))?.sessionId).toBe('S1')
      await joinSession(db, 'joiner', 'S2') // no-op: already bound
      expect((await getTaker(db, 'joiner'))?.sessionId).toBe('S1')
    })
  })
})
