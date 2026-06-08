import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { auth } from '../firebase'
import { isAdmin } from '../auth/adminAuth'

export function useIsAdmin(): { user: User | null; admin: boolean; loading: boolean } {
  const [user, setUser] = useState<User | null>(null)
  const [admin, setAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  useEffect(() =>
    onAuthStateChanged(auth, async (u) => {
      setUser(u)
      setAdmin(await isAdmin(u))
      setLoading(false)
    }), [])
  return { user, admin, loading }
}
