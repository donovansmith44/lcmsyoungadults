import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { getTestEnv } from '../../test/emulator'
import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore'
import { submitTest } from './submit'
import { setSharing } from './takers'
import { scoreType, OEJTS_ITEMS } from '../domain/oejts'
import type { Answers, AnswerValue } from '../domain/types'

const uniform = (v: AnswerValue): Answers =>
  Object.fromEntries(OEJTS_ITEMS.map((i) => [i.id, v])) as Answers
const alternating = (): Answers =>
  Object.fromEntries(OEJTS_ITEMS.map((i) => [i.id, (i.id % 2 ? 1 : 5) as AnswerValue])) as Answers

describe('multi-user session (emulator)', () => {
  beforeEach(async () => { (await getTestEnv()).clearFirestore() })
  afterAll(async () => { await (await getTestEnv()).cleanup() })

  it('each taker gets their own type; sharers see each other and opt-outs are hidden', async () => {
    const env = await getTestEnv()
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await setDoc(doc(db, 'sessions', 's1'), { status: 'active', timerMinutes: 30, groupsFrozenAt: null })

      const people = [
        { u: 'ann', a: uniform(1), share: true },
        { u: 'bob', a: uniform(5), share: true },
        { u: 'cyd', a: uniform(3), share: false }, // opts out of sharing
        { u: 'dan', a: alternating(), share: true },
      ]

      // every taker doc must exist before submit/sharing updates it
      for (const p of people) {
        await setDoc(doc(db, 'takers', p.u), { username: p.u, answers: p.a, completed: false, sharing: false })
      }
      // simulate them all finishing with their own answers, then choosing whether to share
      for (const p of people) {
        await submitTest(db, p.u, p.a, 's1')
        await setSharing(db, p.u, p.share)
      }

      // 1) each taker's stored type is exactly what the scorer computes for THEIR answers
      for (const p of people) {
        const t = (await getDoc(doc(db, 'takers', p.u))).data()!
        expect(t.completed).toBe(true)
        expect(t.sessionId).toBe('s1')
        expect(t.type).toBe(scoreType(p.a)!.type)
      }
      // 2) different answers really do yield different types
      const ann = (await getDoc(doc(db, 'takers', 'ann'))).data()!
      const bob = (await getDoc(doc(db, 'takers', 'bob'))).data()!
      expect(ann.type).not.toBe(bob.type)

      // 3) the shared list (the exact query the result screen uses) shows the sharers only
      const snap = await getDocs(query(
        collection(db, 'takers'),
        where('sessionId', '==', 's1'),
        where('sharing', '==', true),
      ))
      const shared = snap.docs
        .map((d) => d.data())
        .filter((t) => t.completed && t.type)
        .map((t) => ({ username: t.username as string, type: t.type as string }))
      expect(shared.map((s) => s.username).sort()).toEqual(['ann', 'bob', 'dan']) // cyd hidden

      // 4) each sharer can see the others' actual types
      expect(shared.find((s) => s.username === 'ann')!.type).toBe(scoreType(uniform(1))!.type)
      expect(shared.find((s) => s.username === 'bob')!.type).toBe(scoreType(uniform(5))!.type)
      expect(shared.find((s) => s.username === 'dan')!.type).toBe(scoreType(alternating())!.type)
    })
  })
})
