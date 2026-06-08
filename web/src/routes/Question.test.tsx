import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Question } from './Question'
import { OEJTS_ITEMS } from '../domain/oejts'

describe('Question', () => {
  it('renders the item at the resume index and autosaves on answer', () => {
    const onAnswer = vi.fn()
    render(<Question index={17} item={OEJTS_ITEMS[17]} total={32} onAnswer={onAnswer} value={undefined} />)
    expect(screen.getByText('Question 18 of 32')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('radio')[4])
    expect(onAnswer).toHaveBeenCalledWith(OEJTS_ITEMS[17].id, 5)
  })
})
