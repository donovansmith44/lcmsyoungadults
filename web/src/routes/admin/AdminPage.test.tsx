import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('../../hooks/useIsAdmin', () => ({ useIsAdmin: () => ({ user: { email: 'a@b.c' }, admin: true, loading: false }) }))
vi.mock('../../hooks/useSessions', () => ({ useSessions: () => [{ id: 's1', name: 'Fri', status: 'active', timerMinutes: 15, startedAt: 0, endedAt: null, groupsFrozenAt: null, createdBy: 'a@b.c' }] }))
vi.mock('../../hooks/useRoster', () => ({ useRoster: () => [{ id: 'mae', username: 'Mae', completed: true, type: 'INTJ', seRank: 1, sharing: false, sessionId: 's1', group: 'games', groupOverride: false }] }))
vi.mock('../../firebase', () => ({ db: {} }))
// ManageAdmins subscribes to Firestore on mount; stub it out for this test.
vi.mock('./ManageAdmins', () => ({ ManageAdmins: () => null }))

import { AdminPage } from './AdminPage'

describe('AdminPage roster panel', () => {
  it('roster panel can be minimized and closed', () => {
    render(<AdminPage />)
    fireEvent.click(screen.getByRole('button', { name: /^fri/i })) // select the session
    expect(screen.getByText('Mae')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /minimize roster/i }))
    expect(screen.queryByText('Mae')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /expand roster/i }))
    expect(screen.getByText('Mae')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /close roster/i }))
    expect(screen.queryByText('Mae')).toBeNull()
  })
})
