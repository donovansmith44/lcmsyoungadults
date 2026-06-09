import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Landing } from './Landing'

describe('Landing', () => {
  it('requires a non-empty username and reports it trimmed', () => {
    const onBegin = vi.fn()
    render(<Landing onBegin={onBegin} />)
    const begin = screen.getByRole('button', { name: /begin/i })
    fireEvent.click(begin)
    expect(onBegin).not.toHaveBeenCalled() // empty -> ignored
    fireEvent.change(screen.getByPlaceholderText(/username/i), { target: { value: '  Donovan ' } })
    fireEvent.click(begin)
    expect(onBegin).toHaveBeenCalledWith('Donovan')
  })

  it('shows a begin error when provided', () => {
    render(<Landing onBegin={() => {}} error="That name's taken — choose another." />)
    expect(screen.getByText(/that name's taken/i)).toBeInTheDocument()
  })
})
