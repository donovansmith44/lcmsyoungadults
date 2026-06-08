import { useState } from 'react'
import { db } from '../../firebase'
import { AdminGate } from './AdminGate'
import { SessionList } from './SessionList'
import { Roster } from './Roster'
import { ManageAdmins } from './ManageAdmins'
import { useSessions } from '../../hooks/useSessions'
import { useRoster } from '../../hooks/useRoster'
import { setTakerGroupOverride } from '../../data/adminOps'

export function AdminPage() {
  const sessions = useSessions()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const rows = useRoster(selectedId)

  return (
    <AdminGate>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h1>Session admin</h1>
        <SessionList sessions={sessions} selectedId={selectedId} onSelect={setSelectedId} />
        {selectedId && <Roster rows={rows} onOverride={(u, g) => setTakerGroupOverride(db, u, g)} />}
        <ManageAdmins />
      </div>
    </AdminGate>
  )
}
