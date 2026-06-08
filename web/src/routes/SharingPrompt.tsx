import { Button } from '../ui/Button'

export function SharingPrompt({ onChoose }: { onChoose: (share: boolean) => void }) {
  return (
    <div className="screen" style={{ background: 'linear-gradient(160deg, var(--pink) 0%, var(--cream) 75%)' }}>
      <div className="card">
        <p style={{ fontSize: '1rem', lineHeight: 1.4 }}>
          Share your result with others in this session who have also taken the test and shared theirs?
        </p>
        <div style={{ display: 'flex', gap: '.8rem', justifyContent: 'center', marginTop: '1rem' }}>
          <Button onClick={() => onChoose(true)}>Yes, share</Button>
          <Button onClick={() => onChoose(false)} style={{ background: 'transparent', color: 'var(--teal)', border: '1.5px solid var(--teal)' }}>No, keep private</Button>
        </div>
      </div>
    </div>
  )
}
