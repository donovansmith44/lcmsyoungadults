export function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = (current / total) * 100
  return (
    <div style={{ width: '100%' }}>
      <div style={{ height: 6, background: 'var(--pink-deep)', borderRadius: 3, overflow: 'hidden' }}>
        <div data-testid="progress-fill" style={{ width: `${pct}%`, height: '100%', background: 'var(--teal)' }} />
      </div>
      <div style={{ marginTop: 8, fontSize: '.7rem', letterSpacing: '.12em', textTransform: 'uppercase', opacity: 0.65 }}>
        Question {current} of {total}
      </div>
    </div>
  )
}
