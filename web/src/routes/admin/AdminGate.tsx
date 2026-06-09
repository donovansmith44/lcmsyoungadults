import type { ReactNode } from 'react'
import { Button } from '../../ui/Button'
import { useIsAdmin } from '../../hooks/useIsAdmin'
import { signInWithGoogle, signOutAdmin } from '../../auth/adminAuth'

export function AdminGate({ children }: { children: ReactNode }) {
  const { user, admin, loading } = useIsAdmin()
  if (loading) return <div className="screen"><div className="screen-center"><p>Loading…</p></div></div>
  if (admin) return <>{children}</>

  // Not authorized: signed out, anonymous (guest), or a non-allowlisted email.
  const email = user?.email
  return (
    <div className="screen"><div className="screen-center">
      <div className="card" style={{ maxWidth: '24rem' }}>
        <h2 style={{ marginTop: 0 }}>Admin</h2>
        {!user && <p>Sign in with your authorized Google account to manage sessions.</p>}
        {user && !email && <p>You're signed in as a guest. Sign in with your authorized Google account to continue.</p>}
        {user && email && <p>Signed in as <b>{email}</b>, but that account is <b>not authorized</b>.</p>}
        <Button onClick={() => { signInWithGoogle().catch(() => {}) }} style={{ width: '100%' }}>Sign in with Google</Button>
        {user && (
          <button onClick={() => signOutAdmin()} style={{ marginTop: '.6rem', background: 'none', border: 'none', color: 'var(--teal)', textDecoration: 'underline', cursor: 'pointer' }}>Sign out</button>
        )}
      </div>
    </div></div>
  )
}
