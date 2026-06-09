import {
  Firestore, doc, getDoc, updateDoc, collection, query, where, getDocs, serverTimestamp,
} from 'firebase/firestore'
import { scoreType } from '../domain/oejts'
import { seRank, seStrength } from '../domain/seRank'
import { assignLatecomer } from '../domain/grouping'
import type { GroupCounts } from '../domain/grouping'
import { normalizeUsername } from './takers'
import type { Answers, Group } from '../domain/types'

async function countGroups(db: Firestore, sessionId: string): Promise<GroupCounts> {
  const snap = await getDocs(query(collection(db, 'takers'), where('sessionId', '==', sessionId)))
  const counts: GroupCounts = { scavenger: 0, games: 0 }
  snap.docs.forEach((d) => {
    const g = d.data().group as Group | null
    if (g === 'scavenger' || g === 'games') counts[g]++
  })
  return counts
}

/** Completes a taker: scores, binds to the taker's OWN session, latecomer group if frozen. */
export async function submitTest(db: Firestore, username: string, answers: Answers): Promise<void> {
  const result = scoreType(answers)
  if (!result) throw new Error('Test is incomplete')

  const ref = doc(db, 'takers', normalizeUsername(username))
  const takerSnap = await getDoc(ref)
  const sessionId = (takerSnap.exists() ? takerSnap.data().sessionId : null) as string | null

  let group: Group | null = null
  if (sessionId) {
    const sessionSnap = await getDoc(doc(db, 'sessions', sessionId))
    if (sessionSnap.exists() && sessionSnap.data().groupsFrozenAt) {
      group = assignLatecomer(await countGroups(db, sessionId))
    }
  }

  await updateDoc(ref, {
    completed: true,
    type: result.type,
    axisScores: result.axisScores,
    seRank: seRank(result.type),
    seStrength: seStrength(result.axisScores),
    group,
    completedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}
