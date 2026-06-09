import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- module mocks (hoisted) ---
vi.mock('../firebase', () => ({ db: {}, auth: {} }))
vi.mock('../auth/takerAuth', () => ({ ensureAnonymous: () => Promise.resolve({}) }))
vi.mock('../data/takers', () => ({
  upsertTaker: vi.fn(() => Promise.resolve()),
  recordAnswer: vi.fn(() => Promise.resolve()),
  setSharing: vi.fn(() => Promise.resolve()),
}))
vi.mock('../data/submit', () => ({ submitTest: vi.fn(() => Promise.resolve()) }))
vi.mock('../data/freeze', () => ({ freezeSessionGroups: vi.fn(() => Promise.resolve()) }))
vi.mock('../hooks/useSharedList', () => ({ useSharedList: () => [] }))
vi.mock('../hooks/useNow', () => ({ useNow: () => 9_999_999_999 })) // far future -> timer expired
// mutable hook state (vitest allows mock factories to close over `mock*`-prefixed vars)
vi.mock('../hooks/useActiveSession', () => ({ useActiveSession: () => ({ session: mockSession, loading: false }) }))
vi.mock('../hooks/useSession', () => ({ useSession: () => null }))
vi.mock('../hooks/useTaker', () => ({ useTaker: () => mockTaker }))

let mockSession: unknown
let mockTaker: unknown

import { TestApp } from './TestApp'
import { setSharing } from '../data/takers'

describe('TestApp', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('prompts to share when the timer runs out, then returns to the test', async () => {
    localStorage.setItem('lya.personality.username', 'Mae')
    mockSession = { id: 's1', status: 'active', timerMinutes: 0, startedAt: 0, groupsFrozenAt: 1 }
    mockTaker = {
      taker: {
        username: 'Mae', answers: { 1: 3 }, completed: false, type: null, axisScores: null,
        seRank: null, seStrength: null, sharing: false, sessionId: 's1', group: 'scavenger', groupOverride: false,
      },
      loading: false,
    }

    render(<TestApp />)
    // timer is 0 -> the buzzer share opt-in appears mid-test
    await waitFor(() => expect(screen.getByText(/share your result/i)).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /yes, share/i }))
    await waitFor(() => expect(setSharing).toHaveBeenCalledWith(expect.anything(), 'Mae', true))
    // ...and they are returned to answering (the 5 lean-bar choices reappear)
    await waitFor(() => expect(screen.getAllByRole('radio')).toHaveLength(5))
  })

  it('offers a fresh start instead of hanging when the stored taker has no doc', async () => {
    localStorage.setItem('lya.personality.username', 'ghost')
    mockSession = null
    mockTaker = { taker: null, loading: false } // loaded, but the doc is missing
    render(<TestApp />)
    expect(await screen.findByText(/couldn't find a test in progress/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /start a new test/i }))
    expect(await screen.findByPlaceholderText(/username/i)).toBeInTheDocument()
  })
})
