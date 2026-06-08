import { useEffect, useState } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../firebase'
import type { SessionDoc } from '../data/sessions'

export function useSessions(): SessionDoc[] {
  const [sessions, setSessions] = useState<SessionDoc[]>([])
  useEffect(() => {
    const q = query(collection(db, 'sessions'), orderBy('startedAt', 'desc'))
    return onSnapshot(q, (snap) => {
      setSessions(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SessionDoc, 'id'>) })))
    })
  }, [])
  return sessions
}
