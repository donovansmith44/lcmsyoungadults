import {
  Firestore, doc, updateDoc, collection, query, where, getDocs, serverTimestamp,
} from 'firebase/firestore'
import { freezeGroups } from '../domain/grouping'
import type { Group, TakerForGrouping } from '../domain/types'

export async function setTakerGroupOverride(db: Firestore, username: string, group: Group): Promise<void> {
  await updateDoc(doc(db, 'takers', username), { group, groupOverride: true })
}

/** Re-runs the split for a session (even if already frozen), honoring overrides. */
export async function recomputeSessionGroups(db: Firestore, sessionId: string): Promise<void> {
  const snap = await getDocs(query(collection(db, 'takers'), where('sessionId', '==', sessionId)))
  const takers: TakerForGrouping[] = snap.docs.map((d) => {
    const t = d.data()
    return {
      id: d.id, completed: t.completed, seRank: t.seRank ?? undefined,
      seStrength: t.seStrength ?? undefined, group: t.group ?? null,
      groupOverride: t.groupOverride ?? false,
    }
  })
  const assignments = freezeGroups(takers)
  await Promise.all(
    Object.entries(assignments).map(([id, group]) => updateDoc(doc(db, 'takers', id), { group })),
  )
  await updateDoc(doc(db, 'sessions', sessionId), { groupsFrozenAt: serverTimestamp() })
}

export async function deleteSession(db: Firestore, id: string): Promise<void> {
  // Delete the session doc; takers keep their sessionId for archival audit.
  const { deleteDoc } = await import('firebase/firestore')
  await deleteDoc(doc(db, 'sessions', id))
}
