import { Button } from '../ui/Button'

export function SharingPrompt({ onChoose }: { onChoose: (share: boolean) => void }) {
  return (
    <div className="screen">
      <div className="screen-center">
        <p className="serif" style={{ fontSize: '1.5rem', lineHeight: 1.35, maxWidth: '22ch' }}>
          Share your result with others in this session who've also shared theirs?
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.7rem', width: '100%', marginTop: '1rem' }}>
          <Button onClick={() => onChoose(true)} style={{ width: '100%' }}>Yes, share</Button>
          <Button onClick={() => onChoose(false)} style={{ width: '100%', background: 'transparent', color: 'var(--teal)', border: '1.5px solid var(--teal)' }}>No, keep private</Button>
        </div>
      </div>
    </div>
  )
}
