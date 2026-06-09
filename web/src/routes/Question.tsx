import { LeanBar } from '../ui/LeanBar'
import { QUESTION_COPY } from '../domain/questionText'
import type { AnswerValue, OejtsItem } from '../domain/types'

interface Props {
  index: number              // 0-based
  total: number
  item: OejtsItem
  value: AnswerValue | undefined
  onAnswer: (itemId: number, value: AnswerValue) => void
  onBack?: () => void
  canBack?: boolean
  onExit?: () => void
}

export function Question({ index, total, item, value, onAnswer, onBack, canBack, onExit }: Props) {
  const copy = QUESTION_COPY[item.id]
  const pct = (index / total) * 100
  return (
    <div className="screen">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button
          onClick={onExit}
          style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--teal)', fontSize: '.72rem', letterSpacing: '.1em', textTransform: 'uppercase', opacity: 0.6, padding: '2px 4px' }}
        >↺ Start over</button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingTop: 4 }}>
        <button
          onClick={onBack}
          aria-label="Back"
          style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--teal)', fontSize: '1.6rem', lineHeight: 1, padding: '2px 8px', borderRadius: 10, opacity: 0.8, visibility: canBack ? 'visible' : 'hidden' }}
        >‹</button>
        <div style={{ flex: 1, height: 6, background: '#01404f1f', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--teal)', borderRadius: 4, transition: 'width .35s ease' }} />
        </div>
        <div style={{ fontSize: '.72rem', letterSpacing: '.14em', textTransform: 'uppercase', opacity: 0.6, whiteSpace: 'nowrap' }}>{index + 1} / {total}</div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '2.2rem' }}>
        <h2 style={{ fontWeight: 600, fontSize: '1.7rem', lineHeight: 1.28, letterSpacing: '.005em', maxWidth: '19ch', margin: 0 }}>{copy.question}</h2>
        <LeanBar left={copy.left} right={copy.right} value={value} onChange={(v) => onAnswer(item.id, v)} />
      </div>
    </div>
  )
}
