import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where, limit } from 'firebase/firestore'
import { db } from '../firebase'
import type { SessionDoc } from '../data/sessions'

export function useActiveSession(): { session: SessionDoc | null; loading: boolean } {
  const [session, setSession] = useState<SessionDoc | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const q = query(collection(db, 'sessions'), where('status', '==', 'active'), limit(1))
    return onSnapshot(q, (snap) => {
      setSession(snap.empty ? null : { id: snap.docs[0].id, ...(snap.docs[0].data() as Omit<SessionDoc, 'id'>) })
      setLoading(false)
    })
  }, [])
  return { session, loading }
}
