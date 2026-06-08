import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../firebase'

export interface SharedEntry { username: string; type: string }

/** Live list of sharers in a session. Empty when sessionId is null. */
export function useSharedList(sessionId: string | null): SharedEntry[] {
  const [list, setList] = useState<SharedEntry[]>([])
  useEffect(() => {
    if (!sessionId) { setList([]); return }
    const q = query(
      collection(db, 'takers'),
      where('sessionId', '==', sessionId),
      where('sharing', '==', true),
    )
    return onSnapshot(q, (snap) => {
      setList(
        snap.docs
          .map((d) => d.data())
          .filter((t) => t.completed && t.type)
          .map((t) => ({ username: t.username as string, type: t.type as string })),
      )
    })
  }, [sessionId])
  return list
}
