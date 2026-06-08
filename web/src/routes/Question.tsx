import { ProgressBar } from '../ui/ProgressBar'
import { Slider } from '../ui/Slider'
import type { AnswerValue, OejtsItem } from '../domain/types'

interface Props {
  index: number              // 0-based
  total: number
  item: OejtsItem
  value: AnswerValue | undefined
  onAnswer: (itemId: number, value: AnswerValue) => void
}

export function Question({ index, total, item, value, onAnswer }: Props) {
  return (
    <div className="screen">
      <div className="card" style={{ textAlign: 'left' }}>
        <ProgressBar current={index + 1} total={total} />
        <p style={{ fontSize: '1.05rem', fontWeight: 600, lineHeight: 1.35, margin: '1.2rem 0 0' }}>
          {item.left} <span style={{ opacity: 0.5 }}>↔</span> {item.right}
        </p>
        <Slider left={item.left} right={item.right} value={value} onChange={(v) => onAnswer(item.id, v)} />
      </div>
    </div>
  )
}
