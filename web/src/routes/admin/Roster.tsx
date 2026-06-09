import type { RosterRow } from '../../hooks/useRoster'
import type { Group } from '../../domain/types'

interface Props {
  rows: RosterRow[]
  onOverride: (id: string, group: Group) => void
}

export function Roster({ rows, onOverride }: Props) {
  return (
    <div className="card" style={{ width: '100%', overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.85rem' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--pink-deep)' }}>
            <th>User</th><th>Type</th><th>Se</th><th>Share</th><th>Group</th><th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={{ borderBottom: '1px solid rgba(1,64,79,.08)' }}>
              <td>{r.username}</td>
              <td>{r.completed ? r.type : <i style={{ opacity: 0.5 }}>testing…</i>}</td>
              <td>{r.seRank ?? '—'}</td>
              <td>{r.sharing ? '✓' : ''}</td>
              <td>{r.group ?? '—'}{r.groupOverride ? ' 📌' : ''}</td>
              <td style={{ display: 'flex', gap: '.3rem' }}>
                <button aria-label={`move ${r.username} to scavenger`} onClick={() => onOverride(r.id, 'scavenger')}
                  style={{ background: 'none', border: '1px solid var(--teal)', borderRadius: 999, padding: '.15rem .55rem', cursor: 'pointer', color: 'var(--teal)', fontSize: '.72rem' }}>→ Scavenger</button>
                <button aria-label={`move ${r.username} to games`} onClick={() => onOverride(r.id, 'games')}
                  style={{ background: 'none', border: '1px solid var(--teal)', borderRadius: 999, padding: '.15rem .55rem', cursor: 'pointer', color: 'var(--teal)', fontSize: '.72rem' }}>→ Games</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
