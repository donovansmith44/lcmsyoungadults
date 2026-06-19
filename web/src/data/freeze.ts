import {
  Firestore, runTransaction, doc, collection, query, where, getDocs, serverTimestamp,
} from 'firebase/firestore'
import { freezeGroups } from '../domain/grouping'
import type { TakerForGrouping } from '../domain/types'

/**
 * Computes and persists the frozen group split for a session. Idempotent.
 * Returns how many takers were grouped (0 if it was already frozen) plus the
 * alreadyFrozen flag, so callers can show an honest confirmation.
 */
export async function freezeSessionGroups(
  db: Firestore, sessionId: string,
): Promise<{ assigned: number; alreadyFrozen: boolean }> {
  // Read takers outside the txn (collection reads aren't transactional); the txn
  // guards the frozen flag so concurrent callers don't double-write.
  const takersSnap = await getDocs(
    query(collection(db, 'takers'), where('sessionId', '==', sessionId)),
  )
  const takers: TakerForGrouping[] = takersSnap.docs.map((d) => {
    const t = d.data()
    return {
      id: d.id, completed: t.completed, seRank: t.seRank ?? undefined,
      seStrength: t.seStrength ?? undefined, group: t.group ?? null,
      groupOverride: t.groupOverride ?? false,
    }
  })

  const assignments = freezeGroups(takers)

  let alreadyFrozen = false
  await runTransaction(db, async (txn) => {
    const sessionRef = doc(db, 'sessions', sessionId)
    const sessionSnap = await txn.get(sessionRef)
    if (!sessionSnap.exists()) throw new Error('Session not found')
    if (sessionSnap.data().groupsFrozenAt) { alreadyFrozen = true; return } // already frozen -> no-op

    for (const [id, group] of Object.entries(assignments)) {
      txn.update(doc(db, 'takers', id), { group })
    }
    txn.update(sessionRef, { groupsFrozenAt: serverTimestamp() })
  })
  return { assigned: alreadyFrozen ? 0 : Object.keys(assignments).length, alreadyFrozen }
}
