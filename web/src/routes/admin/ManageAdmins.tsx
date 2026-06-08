import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase'
import { addAdmin, removeAdmin } from '../../data/admins'
import { Button } from '../../ui/Button'

export function ManageAdmins() {
  const [emails, setEmails] = useState<string[]>([])
  const [email, setEmail] = useState('')
  useEffect(() =>
    onSnapshot(collection(db, 'admins'), (snap) => setEmails(snap.docs.map((d) => d.id))), [])

  return (
    <div className="card" style={{ width: '100%' }}>
      <h3 style={{ marginTop: 0 }}>Admins</h3>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {emails.map((e) => (
          <li key={e} style={{ display: 'flex', justifyContent: 'space-between', padding: '.3rem 0' }}>
            <span>{e}</span>
            <button onClick={() => removeAdmin(db, e)} style={{ background: 'none', border: 'none', color: '#a3322b', cursor: 'pointer' }}>remove</button>
          </li>
        ))}
      </ul>
      <div style={{ display: 'flex', gap: '.5rem' }}>
        <input placeholder="email@domain" value={email} onChange={(e) => setEmail(e.target.value)}
          style={{ flex: 1, padding: '.5rem', borderRadius: 10, border: '1.5px solid var(--pink-deep)' }} />
        <Button onClick={() => { if (email.trim()) { addAdmin(db, email.trim()); setEmail('') } }}>Add</Button>
      </div>
    </div>
  )
}
