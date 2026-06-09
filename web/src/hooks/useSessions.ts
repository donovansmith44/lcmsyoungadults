import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import type { SessionDoc } from '../data/sessions'

/** Firestore Timestamp | number | null -> ms. Missing/null sorts NEWEST (top). */
export function sessionStartMillis(startedAt: unknown): number {
  if (startedAt && typeof startedAt === 'object' && 'toMillis' in startedAt) {
    return (startedAt as { toMillis(): number }).toMillis()
  }
  return typeof startedAt === 'number' ? startedAt : Number.POSITIVE_INFINITY
}

export function sortSessionsByStartedDesc(sessions: SessionDoc[]): SessionDoc[] {
  return [...sessions].sort((a, b) => sessionStartMillis(b.startedAt) - sessionStartMillis(a.startedAt))
}

export function useSessions(): SessionDoc[] {
  const [sessions, setSessions] = useState<SessionDoc[]>([])
  useEffect(() => {
    // Deliberately NOT orderBy('startedAt'): Firestore drops docs missing the ordered
    // field, which would hide an active session whose startedAt is unset (e.g. a
    // serverTimestamp not yet resolved, or malformed/leftover data) — while
    // getActiveSession still counts it and blocks new sessions. Read the whole
    // collection and sort client-side so nothing can go invisible.
    return onSnapshot(collection(db, 'sessions'), (snap) => {
      setSessions(sortSessionsByStartedDesc(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SessionDoc, 'id'>) })),
      ))
    })
  }, [])
  return sessions
}
