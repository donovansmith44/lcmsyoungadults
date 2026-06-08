import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Slider } from './Slider'

describe('Slider', () => {
  it('renders both poles and 5 choices, and reports the chosen value', () => {
    const onChange = vi.fn()
    render(<Slider left="not me" right="very me" value={undefined} onChange={onChange} />)
    expect(screen.getByText('not me')).toBeInTheDocument()
    expect(screen.getByText('very me')).toBeInTheDocument()
    const choices = screen.getAllByRole('radio')
    expect(choices).toHaveLength(5)
    fireEvent.click(choices[4])
    expect(onChange).toHaveBeenCalledWith(5)
  })

  it('marks the current value as selected', () => {
    render(<Slider left="a" right="b" value={3} onChange={() => {}} />)
    expect(screen.getAllByRole('radio')[2]).toHaveAttribute('aria-checked', 'true')
  })
})
