import { useState } from 'react'
import { Button } from '../ui/Button'

export function Landing({ onBegin }: { onBegin: (username: string) => void }) {
  const [name, setName] = useState('')
  const submit = () => { const t = name.trim(); if (t) onBegin(t) }
  return (
    <div className="screen">
      <div className="screen-center">
        <img src="/brand/logo.png" alt="" width={86} height={86} style={{ marginBottom: '.4rem' }} />
        <div className="eyebrow">Lutheran Young Adults</div>
        <h1 style={{ fontWeight: 800, fontSize: '2.4rem', letterSpacing: '.02em', lineHeight: 1.05, margin: '.5rem 0 0' }}>Personality&nbsp;Test</h1>
        <div style={{ width: '100%', marginTop: '1.8rem' }}>
          <input
            placeholder="enter a username…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            style={{ width: '100%', fontFamily: 'var(--font-ui)', fontSize: '1rem', color: 'var(--teal)', background: 'var(--cream)', border: '1.5px solid var(--pink-deep)', borderRadius: 14, padding: '.9rem 1rem', marginBottom: '.9rem', textAlign: 'center' }}
          />
          <Button onClick={submit} style={{ width: '100%' }}>Begin →</Button>
        </div>
      </div>
    </div>
  )
}
