import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { getTestEnv } from '../../test/emulator'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { submitTest } from './submit'
import type { Answers, AnswerValue } from '../domain/types'
import { OEJTS_ITEMS } from '../domain/oejts'

const answersAll = (v: AnswerValue): Answers =>
  Object.fromEntries(OEJTS_ITEMS.map((i) => [i.id, v])) as Answers

describe('submitTest (emulator)', () => {
  beforeEach(async () => { (await getTestEnv()).clearFirestore() })
  afterAll(async () => { await (await getTestEnv()).cleanup() })

  it('binds to the active session, stamps type/seRank, leaves group null when unfrozen', async () => {
    const env = await getTestEnv()
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await setDoc(doc(db, 'takers', 'mae'), { username: 'Mae', answers: answersAll(3), completed: false })
      await setDoc(doc(db, 'sessions', 's1'), { status: 'active', timerMinutes: 30, groupsFrozenAt: null })
      await submitTest(db, 'Mae', answersAll(3), 's1')
      const t = (await getDoc(doc(db, 'takers', 'mae'))).data()!
      expect(t.completed).toBe(true)
      expect(t.type).toMatch(/^[EI][SN][TF][JP]$/)
      expect(t.sessionId).toBe('s1')
      expect(t.group).toBeNull()
    })
  })

  it('latecomer in a frozen session is placed into the smaller group', async () => {
    const env = await getTestEnv()
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await setDoc(doc(db, 'sessions', 's1'), { status: 'active', timerMinutes: 30, groupsFrozenAt: 1 })
      // existing: 2 scavenger, 1 games -> latecomer should go to games
      await setDoc(doc(db, 'takers', 'a'), { username: 'a', sessionId: 's1', completed: true, group: 'scavenger', sharing: false })
      await setDoc(doc(db, 'takers', 'b'), { username: 'b', sessionId: 's1', completed: true, group: 'scavenger', sharing: false })
      await setDoc(doc(db, 'takers', 'c'), { username: 'c', sessionId: 's1', completed: true, group: 'games', sharing: false })
      await setDoc(doc(db, 'takers', 'late'), { username: 'Late', answers: answersAll(3), completed: false })
      await submitTest(db, 'Late', answersAll(3), 's1')
      expect((await getDoc(doc(db, 'takers', 'late'))).data()!.group).toBe('games')
    })
  })

  it('session-less submit (null session) completes with no group', async () => {
    const env = await getTestEnv()
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await setDoc(doc(db, 'takers', 'solo'), { username: 'Solo', answers: answersAll(3), completed: false })
      await submitTest(db, 'Solo', answersAll(3), null)
      const t = (await getDoc(doc(db, 'takers', 'solo'))).data()!
      expect(t.completed).toBe(true)
      expect(t.sessionId).toBeNull()
      expect(t.group).toBeNull()
    })
  })
})
