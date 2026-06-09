import { useEffect, useState } from 'react'
import { db } from '../../firebase'
import { AdminGate } from './AdminGate'
import { SessionList } from './SessionList'
import { Roster } from './Roster'
import { ManageAdmins } from './ManageAdmins'
import { useSessions } from '../../hooks/useSessions'
import { useRoster } from '../../hooks/useRoster'
import { useIsAdmin } from '../../hooks/useIsAdmin'
import { signOutAdmin } from '../../auth/adminAuth'
import { setTakerGroupOverride } from '../../data/adminOps'
import { onAdminError, runAdmin } from './adminError'

export function AdminPage() {
  return (
    <AdminGate>
      <AdminConsole />
    </AdminGate>
  )
}

function AdminConsole() {
  const sessions = useSessions()
  const { user } = useIsAdmin()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const rows = useRoster(selectedId)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => onAdminError(setError), [])

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <h1 style={{ margin: 0 }}>Session admin</h1>
        <div style={{ fontSize: '.8rem', opacity: 0.8, whiteSpace: 'nowrap' }}>
          {user?.email ?? 'guest'} · <button onClick={() => signOutAdmin()} style={{ background: 'none', border: 'none', color: 'var(--teal)', textDecoration: 'underline', cursor: 'pointer' }}>sign out</button>
        </div>
      </div>
      {error && (
        <div style={{ background: '#a3322b', color: 'var(--cream)', borderRadius: 12, padding: '.7rem .9rem', display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
          <span>⚠ {error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: 'var(--cream)', cursor: 'pointer' }}>✕</button>
        </div>
      )}
      <SessionList sessions={sessions} selectedId={selectedId} onSelect={setSelectedId} />
      {selectedId && <Roster rows={rows} onOverride={(u, g) => runAdmin(setTakerGroupOverride(db, u, g))} />}
      <ManageAdmins />
    </div>
  )
}
