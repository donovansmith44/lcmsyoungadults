import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { db, auth } from '../firebase'

/**
 * Live id of the currently-active session (from the meta/activeSession pointer), or null.
 *
 * The meta doc is readable only by signed-in clients, and the taker signs in anonymously
 * lazily (on Begin). Subscribing to the doc before auth would hit a permission-denied and
 * the listener would die without recovering. So we (re)subscribe to the doc only while a
 * user is present, driven by the auth-state listener.
 */
export function useActiveSessionId(): string | null {
  const [id, setId] = useState<string | null>(null)
  useEffect(() => {
    let unsubDoc: (() => void) | undefined
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      unsubDoc?.()
      unsubDoc = undefined
      if (!user) { setId(null); return }
      unsubDoc = onSnapshot(doc(db, 'meta', 'activeSession'), (snap) => {
        setId(snap.exists() ? ((snap.data().sessionId as string | null) ?? null) : null)
      })
    })
    return () => { unsubDoc?.(); unsubAuth() }
  }, [])
  return id
}
