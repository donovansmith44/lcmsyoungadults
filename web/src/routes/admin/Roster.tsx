import type { Group } from '../../domain/types'
import type { RosterRow } from '../../hooks/useRoster'

interface Props {
  rows: RosterRow[]
  onOverride: (username: string, group: Group) => void
}

export function Roster({ rows, onOverride }: Props) {
  return (
    <div className="card" style={{ width: '100%', overflowX: 'auto' }}>
      <h3 style={{ marginTop: 0 }}>Roster ({rows.length})</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.85rem' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--pink-deep)' }}>
            <th>User</th><th>Type</th><th>Se</th><th>Share</th><th>Group</th><th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const other: Group = r.group === 'scavenger' ? 'games' : 'scavenger'
            return (
              <tr key={r.id} style={{ borderBottom: '1px solid rgba(1,64,79,.08)' }}>
                <td>{r.username}</td>
                <td>{r.completed ? r.type : <i style={{ opacity: 0.5 }}>testing…</i>}</td>
                <td>{r.seRank ?? '—'}</td>
                <td>{r.sharing ? '✓' : ''}</td>
                <td>{r.group ?? '—'}{r.groupOverride ? ' 📌' : ''}</td>
                <td>
                  <button onClick={() => onOverride(r.username, other)}
                    style={{ background: 'none', border: '1px solid var(--teal)', borderRadius: 999, padding: '.15rem .6rem', cursor: 'pointer', color: 'var(--teal)', fontSize: '.75rem' }}>
                    Move to {other === 'scavenger' ? 'scavenger' : 'games'}
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
