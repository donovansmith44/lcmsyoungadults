import { useState } from 'react'
import { Button } from '../../ui/Button'

interface Props { name: string; onConfirm: () => void; onCancel: () => void }

export function DeleteConfirm({ name, onConfirm, onCancel }: Props) {
  const [text, setText] = useState('')
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(1,64,79,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
      <div className="card" style={{ maxWidth: '28rem' }}>
        <p>Are you sure you want to delete <b>{name}</b>? Type <b>DELETE</b> and press the button to confirm.</p>
        <input role="textbox" value={text} onChange={(e) => setText(e.target.value)}
          style={{ width: '100%', border: '1.5px solid var(--pink-deep)', borderRadius: 14, padding: '.6rem .8rem', margin: '.6rem 0' }} />
        <div style={{ display: 'flex', gap: '.6rem', justifyContent: 'flex-end' }}>
          <Button onClick={onCancel} style={{ background: 'transparent', color: 'var(--teal)', border: '1.5px solid var(--teal)' }}>Cancel</Button>
          <Button onClick={onConfirm} disabled={text !== 'DELETE'} style={{ background: '#a3322b' }}>Delete</Button>
        </div>
      </div>
    </div>
  )
}
