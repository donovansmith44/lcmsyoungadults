import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { normalizeUsername } from '../data/takers'
import type { TakerDoc } from '../data/takers'

/**
 * Subscribes to a single taker doc. `loading` is true until the first snapshot
 * (or an error) arrives, so callers can tell "still loading" apart from
 * "doc doesn't exist" (both of which leave `taker` null).
 */
export function useTaker(username: string | null): { taker: TakerDoc | null; loading: boolean } {
  const [taker, setTaker] = useState<TakerDoc | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!username) { setTaker(null); setLoading(false); return }
    setLoading(true)
    return onSnapshot(
      doc(db, 'takers', normalizeUsername(username)),
      (snap) => {
        setTaker(snap.exists() ? (snap.data() as TakerDoc) : null)
        setLoading(false)
      },
      () => { setTaker(null); setLoading(false) }, // permission/other error: stop loading
    )
  }, [username])
  return { taker, loading }
}
