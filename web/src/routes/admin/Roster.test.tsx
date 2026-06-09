import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Roster } from './Roster'
import type { RosterRow } from '../../hooks/useRoster'

const rows: RosterRow[] = [
  { id: 'maria', username: 'maria', answers: {}, completed: true, type: 'ENFP', axisScores: null, seRank: 8, seStrength: 0, sharing: true, sessionId: 's1', group: 'games', groupOverride: false },
]

describe('Roster', () => {
  it('lists each taker with type, Se rank, group and labeled override controls', () => {
    const onOverride = vi.fn()
    render(<Roster rows={rows} onOverride={onOverride} />)
    expect(screen.getByText('maria')).toBeInTheDocument()
    expect(screen.getByText('ENFP')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /move maria to scavenger/i }))
    expect(onOverride).toHaveBeenCalledWith('maria', 'scavenger')
  })

  it('each row exposes both group-override buttons calling onOverride(id, group)', () => {
    const onOverride = vi.fn()
    const r2: RosterRow[] = [{ id: 'mae', username: 'Mae', answers: {}, completed: true, type: 'INTJ', axisScores: null, seRank: 1, seStrength: 0, sharing: false, sessionId: 's1', group: 'games', groupOverride: false }]
    render(<Roster rows={r2} onOverride={onOverride} />)
    fireEvent.click(screen.getByRole('button', { name: /move mae to scavenger/i }))
    expect(onOverride).toHaveBeenCalledWith('mae', 'scavenger')
    fireEvent.click(screen.getByRole('button', { name: /move mae to games/i }))
    expect(onOverride).toHaveBeenCalledWith('mae', 'games')
  })
})
