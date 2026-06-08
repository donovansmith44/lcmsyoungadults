import { personalityUrl } from '../domain/personalityUrl'
import type { SharedEntry } from '../hooks/useSharedList'

export function SharedList({ entries }: { entries: SharedEntry[] }) {
  if (entries.length === 0) return null
  return (
    <div style={{ background: 'rgba(1,64,79,.06)', border: '1px solid rgba(1,64,79,.12)', borderRadius: 12, padding: '.7rem .8rem', width: '100%', textAlign: 'left', marginTop: '.6rem' }}>
      <div style={{ opacity: 0.7, marginBottom: '.3rem', fontSize: '.8rem' }}>Shared in this session</div>
      {entries.map((e) => (
        <div key={e.username} style={{ display: 'flex', justifyContent: 'space-between', padding: '.2rem 0', fontSize: '.85rem' }}>
          <span>User: <span>{e.username}</span></span>
          <span>Test Result: <a className="clean" href={personalityUrl(e.type)} target="_blank" rel="noreferrer">{e.type}</a></span>
        </div>
      ))}
    </div>
  )
}
