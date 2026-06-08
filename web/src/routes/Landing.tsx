import { useState } from 'react'
import { Button } from '../ui/Button'

export function Landing({ onBegin }: { onBegin: (username: string) => void }) {
  const [name, setName] = useState('')
  const submit = () => {
    const trimmed = name.trim()
    if (trimmed) onBegin(trimmed)
  }
  return (
    <div className="screen" style={{ background: 'linear-gradient(160deg, var(--pink) 0%, var(--cream) 70%)' }}>
      <div className="card">
        <h1 style={{ margin: '0 0 1rem', fontWeight: 800 }}>Personality Test</h1>
        <input
          placeholder="enter a username…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          style={{ width: '100%', border: '1.5px solid var(--pink-deep)', borderRadius: 14, padding: '.7rem .9rem', marginBottom: '1rem', fontSize: '.95rem' }}
        />
        <Button onClick={submit} style={{ width: '100%' }}>Begin →</Button>
      </div>
    </div>
  )
}
