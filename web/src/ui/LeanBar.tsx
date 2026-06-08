import type { AnswerValue } from '../domain/types'

interface Props {
  left: string
  right: string
  value: AnswerValue | undefined
  onChange: (v: AnswerValue) => void
}

const SIDE = ['left', 'left', 'mid', 'right', 'right'] as const
const SIZE = [54, 44, 34, 44, 54]

function colorFor(side: 'left' | 'mid' | 'right', selected: boolean) {
  const border = side === 'left' ? 'var(--teal)' : side === 'right' ? 'var(--warm)' : '#01404f55'
  const bg = selected
    ? side === 'left' ? 'var(--teal)' : side === 'right' ? 'var(--warm)' : '#01404f88'
    : 'transparent'
  return { border, bg }
}

export function LeanBar({ left, right, value, onChange }: Props) {
  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10, marginBottom: '1rem' }}>
        <span style={{ flex: 1, textAlign: 'left', fontWeight: 600, fontSize: '.95rem', lineHeight: 1.2, color: 'var(--teal)' }}>{left}</span>
        <span style={{ flex: 1, textAlign: 'right', fontWeight: 600, fontSize: '.95rem', lineHeight: 1.2, color: 'var(--warm)' }}>{right}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        {([1, 2, 3, 4, 5] as AnswerValue[]).map((v, i) => {
          const selected = value === v
          const { border, bg } = colorFor(SIDE[i], selected)
          return (
            <button
              key={v}
              role="radio"
              aria-checked={selected}
              aria-label={`Choice ${v}`}
              onClick={() => onChange(v)}
              style={{
                width: SIZE[i], height: SIZE[i], borderRadius: '50%',
                border: `2.5px solid ${border}`, background: bg,
                cursor: 'pointer', padding: 0, display: 'grid', placeItems: 'center',
                transition: 'background .12s ease, transform .12s ease',
              }}
            >
              <span style={{ color: 'var(--cream)', fontSize: '.9rem', opacity: selected ? 1 : 0 }}>✓</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
