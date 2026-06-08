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
    <div className="screen" style={{ background: 'linear-gradient(160deg, var(--pink) 0%, var(--cream) 75%)' }}>
      <div className="card" style={{ background: 'transparent', boxShadow: 'none' }}>
        <p className="serif" style={{ fontSize: '1.05rem', opacity: 0.85, margin: 0 }}>
          {username}, your answers to the test questions indicate that you are an {type}!
        </p>

        {t > 0 ? (
          <p style={{ margin: '.4rem 0' }}>Check back in {t} minute{t === 1 ? '' : 's'} to find out what activity group you'll participate in</p>
        ) : group ? (
          <div style={{ background: 'var(--teal)', color: 'var(--cream)', borderRadius: 999, padding: '.3rem .9rem', display: 'inline-block', fontWeight: 700, margin: '.4rem 0' }}>
            {group === 'scavenger' ? "You're in the scavenger hunt group!" : "You're in the games group!"}
          </div>
        ) : null}

        <p style={{ marginTop: '.6rem' }}>
          To read more, click here:{' '}
          <a className="clean" href={personalityUrl(type)} target="_blank" rel="noreferrer">Read more about {type} →</a>
        </p>

        <label style={{ display: 'flex', gap: '.5rem', justifyContent: 'center', alignItems: 'center', marginTop: '.8rem', fontSize: '.85rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={sharing} onChange={(e) => onToggleShare(e.target.checked)} />
          Share my result with this session
        </label>

        {sharing && <SharedList entries={entries} />}
      </div>
    </div>
  )
}
