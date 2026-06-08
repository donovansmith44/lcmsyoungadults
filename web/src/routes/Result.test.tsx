import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Result } from './Result'

const base = {
  username: 'Donovan', type: 'INTJ', sharing: true,
  entries: [], onToggleShare: () => {},
}

describe('Result', () => {
  it('shows the "check back in T minutes" copy while T > 0', () => {
    render(<Result {...base} t={12} group={null} />)
    expect(screen.getByText(/Donovan, your answers to the test questions indicate that you are an INTJ!/)).toBeInTheDocument()
    expect(screen.getByText(/Check back in 12 minutes/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /read more/i })).toHaveAttribute(
      'href', 'https://www.16personalities.com/intj-personality',
    )
  })

  it('reveals the scavenger group when T = 0', () => {
    render(<Result {...base} t={0} group="scavenger" />)
    expect(screen.getByText(/You're in the scavenger hunt group!/)).toBeInTheDocument()
  })

  it('reveals the games group when T = 0', () => {
    render(<Result {...base} t={0} group="games" />)
    expect(screen.getByText(/You're in the games group!/)).toBeInTheDocument()
  })
})
