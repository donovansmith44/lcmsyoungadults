import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import type { SessionDoc } from '../data/sessions'

/** Subscribes to one session doc by id (the session a taker belongs to). */
export function useSession(sessionId: string | null): SessionDoc | null {
  const [session, setSession] = useState<SessionDoc | null>(null)
  useEffect(() => {
    if (!sessionId) { setSession(null); return }
    return onSnapshot(doc(db, 'sessions', sessionId), (snap) => {
      setSession(snap.exists() ? { id: snap.id, ...(snap.data() as Omit<SessionDoc, 'id'>) } : null)
    })
  }, [sessionId])
  return session
}
