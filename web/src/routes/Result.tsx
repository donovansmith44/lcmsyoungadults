import { personalityUrl } from '../domain/personalityUrl'
import { SharedList } from '../ui/SharedList'
import type { Group } from '../domain/types'
import type { SharedEntry } from '../hooks/useSharedList'

interface Props {
  username: string
  type: string
  t: number
  group: Group | null
  sharing: boolean
  entries: SharedEntry[]
  onToggleShare: (next: boolean) => void
}

export function Result({ username, type, t, group, sharing, entries, onToggleShare }: Props) {
  return (
    <div className="screen">
      <div className="screen-center">
        <p className="serif" style={{ fontSize: '1.3rem', opacity: 0.85, margin: 0, maxWidth: '24ch', lineHeight: 1.35 }}>
          {username}, your answers point to
        </p>
        <div style={{ fontWeight: 800, fontSize: '4.6rem', letterSpacing: '.06em', color: 'var(--teal)', lineHeight: 1, margin: '.4rem 0 .2rem' }}>{type}</div>

        {t > 0 ? (
          <p style={{ fontSize: '1rem', margin: '.2rem 0 1rem', maxWidth: '26ch' }}>Check back in {t} minute{t === 1 ? '' : 's'} for your activity group</p>
        ) : group ? (
          <div style={{ background: 'var(--teal)', color: 'var(--cream)', borderRadius: 999, padding: '.5rem 1.1rem', fontWeight: 700, margin: '.2rem 0 1rem', display: 'inline-block' }}>
            {group === 'scavenger' ? "You're in the scavenger hunt group!" : "You're in the games group!"}
          </div>
        ) : null}

        <a className="clean" href={personalityUrl(type)} target="_blank" rel="noreferrer" style={{ fontSize: '1.05rem' }}>Read more about {type}</a>

        <label style={{ display: 'flex', gap: '.5rem', alignItems: 'center', justifyContent: 'center', marginTop: '1.4rem', fontSize: '.9rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={sharing} onChange={(e) => onToggleShare(e.target.checked)} />
          Share my result with this session
        </label>

        {sharing && <SharedList entries={entries} />}
      </div>
    </div>
  )
}
