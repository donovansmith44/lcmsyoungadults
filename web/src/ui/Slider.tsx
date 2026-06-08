import type { AnswerValue } from '../domain/types'

interface Props {
  left: string
  right: string
  value: AnswerValue | undefined
  onChange: (v: AnswerValue) => void
}

const SIZES = [26, 20, 16, 20, 26]

export function Slider({ left, right, value, onChange }: Props) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '1.5rem .25rem .6rem' }}>
        {([1, 2, 3, 4, 5] as AnswerValue[]).map((v, i) => {
          const selected = value === v
          return (
            <button
              key={v}
              role="radio"
              aria-checked={selected}
              aria-label={`Choice ${v}`}
              onClick={() => onChange(v)}
              style={{
                width: SIZES[i], height: SIZES[i], borderRadius: '50%',
                border: '2px solid var(--teal)',
                background: selected ? 'var(--teal)' : 'transparent',
                opacity: i === 2 ? 0.7 : 1, cursor: 'pointer', padding: 0,
              }}
            />
          )
        })}
      </div>
      <div className="serif" style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.8, fontSize: '.9rem' }}>
        <span>{left}</span>
        <span>{right}</span>
      </div>
    </div>
  )
}
