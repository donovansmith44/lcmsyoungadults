import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Question } from './Question'
import { OEJTS_ITEMS } from '../domain/oejts'
import { QUESTION_COPY } from '../domain/questionText'

describe('Question', () => {
  it('shows progress, the natural-language question, and reports the answer', () => {
    const onAnswer = vi.fn()
    const item = OEJTS_ITEMS[17] // id 18
    render(<Question index={17} item={item} total={32} value={undefined} onAnswer={onAnswer} />)
    expect(screen.getByText('18 / 32')).toBeInTheDocument()
    expect(screen.getByText(QUESTION_COPY[item.id].question)).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('radio')[4])
    expect(onAnswer).toHaveBeenCalledWith(item.id, 5)
  })

  it('fires onBack when the Back control is used', () => {
    const onBack = vi.fn()
    render(<Question index={1} item={OEJTS_ITEMS[1]} total={32} value={undefined} onAnswer={() => {}} onBack={onBack} canBack={true} />)
    fireEvent.click(screen.getByLabelText('Back'))
    expect(onBack).toHaveBeenCalled()
  })
})
