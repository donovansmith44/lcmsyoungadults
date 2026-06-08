import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import type { TakerDoc } from '../data/takers'

export interface RosterRow extends TakerDoc { id: string }

export function useRoster(sessionId: string | null): RosterRow[] {
  const [rows, setRows] = useState<RosterRow[]>([])
  useEffect(() => {
    if (!sessionId) { setRows([]); return }
    const q = query(collection(db, 'takers'), where('sessionId', '==', sessionId))
    return onSnapshot(q, (snap) => {
      setRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() as TakerDoc) })))
    })
  }, [sessionId])
  return rows
}
