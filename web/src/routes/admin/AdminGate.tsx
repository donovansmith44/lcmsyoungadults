import type { ReactNode } from 'react'
import { Button } from '../../ui/Button'
import { useIsAdmin } from '../../hooks/useIsAdmin'
import { signInWithGoogle, signOutAdmin } from '../../auth/adminAuth'

export function AdminGate({ children }: { children: ReactNode }) {
  const { user, admin, loading } = useIsAdmin()
  if (loading) return <div className="screen"><p className="serif">Loading…</p></div>
  if (!user) {
    return (
      <div className="screen"><div className="card">
        <h2>Admin</h2>
        <Button onClick={() => signInWithGoogle()}>Sign in with Google</Button>
      </div></div>
    )
  }
  if (!admin) {
    return (
      <div className="screen"><div className="card">
        <p>Signed in as {(user as { email?: string }).email}, but you are <b>not authorized</b>.</p>
        <Button onClick={() => signOutAdmin()}>Sign out</Button>
      </div></div>
    )
  }
  return <>{children}</>
}
