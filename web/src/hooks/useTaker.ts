import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { normalizeUsername } from '../data/takers'
import type { TakerDoc } from '../data/takers'

export function useTaker(username: string | null): TakerDoc | null {
  const [taker, setTaker] = useState<TakerDoc | null>(null)
  useEffect(() => {
    if (!username) { setTaker(null); return }
    return onSnapshot(doc(db, 'takers', normalizeUsername(username)), (snap) => {
      setTaker(snap.exists() ? (snap.data() as TakerDoc) : null)
    })
  }, [username])
  return taker
}
