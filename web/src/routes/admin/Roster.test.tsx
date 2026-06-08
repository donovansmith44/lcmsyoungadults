import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Roster } from './Roster'
import type { RosterRow } from '../../hooks/useRoster'

const rows: RosterRow[] = [
  { id: 'maria', username: 'maria', answers: {}, completed: true, type: 'ENFP', axisScores: null, seRank: 8, seStrength: 0, sharing: true, sessionId: 's1', group: 'games', groupOverride: false },
]

describe('Roster', () => {
  it('lists each taker with type, Se rank, group and an override control', () => {
    const onOverride = vi.fn()
    render(<Roster rows={rows} onOverride={onOverride} />)
    expect(screen.getByText('maria')).toBeInTheDocument()
    expect(screen.getByText('ENFP')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /move to scavenger/i }))
    expect(onOverride).toHaveBeenCalledWith('maria', 'scavenger')
  })
})
