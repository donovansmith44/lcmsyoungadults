import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Result } from './Result'

const base = {
  username: 'Donovan', type: 'INTJ', sharing: true,
  entries: [], onToggleShare: () => {}, onStartOver: () => {},
}

describe('Result', () => {
  it('shows the type big, readable copy, a countdown while T>0, and a clean read-more link', () => {
    render(<Result {...base} t={12} group={null} />)
    expect(screen.getByText('INTJ')).toBeInTheDocument()
    expect(screen.getByText(/Donovan, your answers point to/)).toBeInTheDocument()
    expect(screen.getByText(/Check back in 12 minutes for your activity group/)).toBeInTheDocument()
    const link = screen.getByRole('link', { name: 'Read more about INTJ' })
    expect(link).toHaveAttribute('href', 'https://www.16personalities.com/intj-personality')
  })

  it('reveals the scavenger group when T = 0', () => {
    render(<Result {...base} t={0} group="scavenger" />)
    expect(screen.getByText(/You're in the scavenger hunt group!/)).toBeInTheDocument()
  })

  it('reveals the games group when T = 0', () => {
    render(<Result {...base} t={0} group="games" />)
    expect(screen.getByText(/You're in the games group!/)).toBeInTheDocument()
  })

  it('offers a "start over" control that fires onStartOver', () => {
    const onStartOver = vi.fn()
    render(<Result username="Mae" type="INTJ" t={0} group={null} sharing={false} entries={[]} onToggleShare={() => {}} onStartOver={onStartOver} />)
    fireEvent.click(screen.getByRole('button', { name: /start over/i }))
    expect(onStartOver).toHaveBeenCalled()
  })
})
