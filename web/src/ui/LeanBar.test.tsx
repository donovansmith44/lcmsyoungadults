import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { LeanBar } from './LeanBar'

describe('LeanBar', () => {
  it('renders both poles and 5 choices, and reports the chosen value', () => {
    const onChange = vi.fn()
    render(<LeanBar left="Energetic" right="Mellow" value={undefined} onChange={onChange} />)
    expect(screen.getByText('Energetic')).toBeInTheDocument()
    expect(screen.getByText('Mellow')).toBeInTheDocument()
    const choices = screen.getAllByRole('radio')
    expect(choices).toHaveLength(5)
    fireEvent.click(choices[4])
    expect(onChange).toHaveBeenCalledWith(5)
  })

  it('marks the current value as selected', () => {
    render(<LeanBar left="a" right="b" value={3} onChange={() => {}} />)
    expect(screen.getAllByRole('radio')[2]).toHaveAttribute('aria-checked', 'true')
  })
})
