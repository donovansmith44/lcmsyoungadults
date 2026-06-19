import { useEffect, useRef, useState } from 'react'
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
import { onAdminNotice, runAdmin } from './adminError'

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
  const [notice, setNotice] = useState<{ msg: string; level: 'error' | 'success' } | null>(null)
  const [rosterMin, setRosterMin] = useState(false)
  useEffect(() => onAdminNotice((msg, level) => setNotice({ msg, level })), [])
  // Success confirmations clear themselves after a few seconds; errors stay until dismissed.
  useEffect(() => {
    if (notice?.level !== 'success') return
    const t = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(t)
  }, [notice])
  // Auto-open the active session's roster once, so the admin immediately sees who's taking
  // the test and their results/activity route without having to click into the session.
  const didAutoSelect = useRef(false)
  useEffect(() => {
    if (didAutoSelect.current || selectedId) return
    const active = sessions.find((s) => s.status === 'active')
    if (active) { setSelectedId(active.id); didAutoSelect.current = true }
  }, [sessions, selectedId])

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <h1 style={{ margin: 0 }}>Session admin</h1>
        <div style={{ fontSize: '.8rem', opacity: 0.8, whiteSpace: 'nowrap' }}>
          {user?.email ?? 'guest'} · <button onClick={() => signOutAdmin()} style={{ background: 'none', border: 'none', color: 'var(--teal)', textDecoration: 'underline', cursor: 'pointer' }}>sign out</button>
        </div>
      </div>
      {notice && (
        <div style={{ background: notice.level === 'success' ? 'var(--teal)' : '#a3322b', color: 'var(--cream)', borderRadius: 12, padding: '.7rem .9rem', display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
          <span>{notice.level === 'success' ? '✓' : '⚠'} {notice.msg}</span>
          <button onClick={() => setNotice(null)} style={{ background: 'none', border: 'none', color: 'var(--cream)', cursor: 'pointer' }}>✕</button>
        </div>
      )}
      <SessionList sessions={sessions} selectedId={selectedId} onSelect={setSelectedId} />
      {selectedId && (
        <div className="card" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Roster ({rows.length})</h3>
            <div style={{ display: 'flex', gap: '.4rem' }}>
              <button onClick={() => setRosterMin((m) => !m)}
                aria-label={rosterMin ? 'expand roster' : 'minimize roster'}
                style={{ background: 'none', border: 'none', color: 'var(--teal)', cursor: 'pointer' }}>
                {rosterMin ? '▸' : '▾'}
              </button>
              <button onClick={() => { setSelectedId(null); setRosterMin(false) }}
                aria-label="close roster"
                style={{ background: 'none', border: 'none', color: 'var(--teal)', cursor: 'pointer' }}>✕</button>
            </div>
          </div>
          {!rosterMin && <Roster rows={rows} onOverride={(u, g) => runAdmin(setTakerGroupOverride(db, u, g))} />}
        </div>
      )}
      <ManageAdmins />
    </div>
  )
}
