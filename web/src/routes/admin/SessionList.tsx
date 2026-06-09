import { useState } from 'react'
import { db } from '../../firebase'
import { Button } from '../../ui/Button'
import { startSession, endSession, archiveSession } from '../../data/sessions'
import { freezeSessionGroups } from '../../data/freeze'
import { recomputeSessionGroups, deleteSession } from '../../data/adminOps'
import { DeleteConfirm } from './DeleteConfirm'
import { useIsAdmin } from '../../hooks/useIsAdmin'
import { runAdmin } from './adminError'
import type { SessionDoc } from '../../data/sessions'

interface Props {
  sessions: SessionDoc[]
  selectedId: string | null
  onSelect: (id: string) => void
  onStartOverride?: (name: string, timer: number) => void
}

export function SessionList({ sessions, selectedId, onSelect, onStartOverride }: Props) {
  const { user } = useIsAdmin()
  const [name, setName] = useState('')
  const [timer, setTimer] = useState(30)
  const [toDelete, setToDelete] = useState<SessionDoc | null>(null)
  const hasActive = sessions.some((s) => s.status === 'active')

  const start = () => {
    if (onStartOverride) return onStartOverride(name.trim(), Number(timer))
    runAdmin(startSession(db, { name: name.trim(), timerMinutes: Number(timer), createdBy: user?.email ?? '' }))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '.8rem' }}>
      <div className="card" style={{ width: '100%' }}>
        <h3 style={{ marginTop: 0 }}>Start a session</h3>
        <input placeholder="Session name" value={name} onChange={(e) => setName(e.target.value)}
          style={{ width: '100%', padding: '.5rem', borderRadius: 10, border: '1.5px solid var(--pink-deep)', marginBottom: '.5rem' }} />
        <label style={{ display: 'block', fontSize: '.8rem' }}>Timer (minutes)
          <input aria-label="timer minutes" type="number" value={timer} onChange={(e) => setTimer(Number(e.target.value))}
            style={{ width: '100%', padding: '.5rem', borderRadius: 10, border: '1.5px solid var(--pink-deep)' }} />
        </label>
        <Button onClick={start} disabled={hasActive || !name.trim()} style={{ marginTop: '.6rem' }}>Start session</Button>
        {hasActive && <p style={{ fontSize: '.75rem', opacity: 0.7 }}>End the active session before starting another.</p>}
      </div>

      {sessions.map((s) => (
        <div key={s.id} className="card" style={{ width: '100%', borderLeft: s.id === selectedId ? '4px solid var(--teal)' : undefined }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button onClick={() => onSelect(s.id)} style={{ background: 'none', border: 'none', fontWeight: 700, cursor: 'pointer', color: 'var(--teal)' }}>
              {s.name} <span style={{ fontWeight: 400, opacity: 0.6, fontSize: '.8rem' }}>({s.status})</span>
            </button>
          </div>
          <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', marginTop: '.5rem' }}>
            {s.status === 'active' && <Button onClick={() => runAdmin(freezeSessionGroups(db, s.id))}>Reveal now</Button>}
            <Button onClick={() => runAdmin(recomputeSessionGroups(db, s.id))}>Recompute</Button>
            {s.status === 'active' && <Button onClick={() => runAdmin(endSession(db, s.id))}>End</Button>}
            {s.status === 'ended' && <Button onClick={() => runAdmin(archiveSession(db, s.id))}>Archive</Button>}
            <Button onClick={() => setToDelete(s)} style={{ background: '#a3322b' }}>Delete</Button>
          </div>
        </div>
      ))}

      {toDelete && (
        <DeleteConfirm
          name={toDelete.name}
          onCancel={() => setToDelete(null)}
          onConfirm={() => { runAdmin(deleteSession(db, toDelete.id)); setToDelete(null) }}
        />
      )}
    </div>
  )
}
