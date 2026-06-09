import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- module mocks (hoisted) ---
vi.mock('../firebase', () => ({ db: {}, auth: {} }))
vi.mock('../auth/takerAuth', () => ({ ensureAnonymous: vi.fn(() => Promise.resolve({ uid: 'uidA' })) }))
vi.mock('../data/takers', () => ({
  upsertTaker: vi.fn(() => Promise.resolve()),
  recordAnswer: vi.fn(() => Promise.resolve()),
  setSharing: vi.fn(() => Promise.resolve()),
  UsernameTakenError: class UsernameTakenError extends Error {},
}))
vi.mock('../data/submit', () => ({ submitTest: vi.fn(() => Promise.resolve()) }))
vi.mock('../data/freeze', () => ({ freezeSessionGroups: vi.fn(() => Promise.resolve()) }))
vi.mock('../hooks/useSharedList', () => ({ useSharedList: () => [] }))
// mutable mock state (vitest hoisting allows factories to close over `mock*` vars)
vi.mock('../hooks/useNow', () => ({ useNow: () => mockNow }))
vi.mock('../hooks/useActiveSession', () => ({ useActiveSession: () => ({ session: mockSession, loading: false }) }))
vi.mock('../hooks/useSession', () => ({ useSession: () => mockTakerSession }))
vi.mock('../hooks/useTaker', () => ({ useTaker: () => mockTaker }))

let mockNow = 9_999_999_999
let mockSession: unknown = null
let mockTakerSession: unknown = null
let mockTaker: unknown = null

import { TestApp } from './TestApp'
import { setSharing, upsertTaker, UsernameTakenError } from '../data/takers'
import { freezeSessionGroups } from '../data/freeze'
import { ensureAnonymous } from '../auth/takerAuth'

const completedTaker = (overrides: Record<string, unknown> = {}) => ({
  taker: {
    username: 'Mae', answers: {}, completed: true, type: 'INTJ', axisScores: null,
    seRank: null, seStrength: null, sharing: false, sessionId: 'sA', group: 'scavenger', groupOverride: false,
    ...overrides,
  },
  loading: false,
})

describe('TestApp', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    mockNow = 9_999_999_999
    mockSession = null
    mockTakerSession = null
    mockTaker = { taker: null, loading: false }
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
    await waitFor(() => expect(screen.getByText(/share your result/i)).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /yes, share/i }))
    await waitFor(() => expect(setSharing).toHaveBeenCalledWith(expect.anything(), 'Mae', true))
    await waitFor(() => expect(screen.getAllByRole('radio')).toHaveLength(5))
  })

  it('offers a fresh start instead of hanging when the stored taker has no doc', async () => {
    localStorage.setItem('lya.personality.username', 'ghost')
    mockTaker = { taker: null, loading: false } // loaded, but the doc is missing
    render(<TestApp />)
    expect(await screen.findByText(/couldn't find a test in progress/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /start a new test/i }))
    expect(await screen.findByPlaceholderText(/username/i)).toBeInTheDocument()
  })

  it('result countdown follows the TAKER\'s own session, not whatever is active now', async () => {
    localStorage.setItem('lya.personality.username', 'Mae')
    mockNow = 300_000 // 5 minutes since epoch-0 starts
    // the active session is a DIFFERENT, longer one — it must be ignored
    mockSession = { id: 'sB', status: 'active', timerMinutes: 99, startedAt: 0, groupsFrozenAt: null }
    // the taker's own session: 15-minute timer started at 0 -> 10 minutes remain
    mockTakerSession = { id: 'sA', status: 'active', timerMinutes: 15, startedAt: 0, groupsFrozenAt: null }
    mockTaker = completedTaker({ sessionId: 'sA' })

    render(<TestApp />)
    expect(await screen.findByText(/check back in 10 minutes/i)).toBeInTheDocument()
    // not the active session's 94 minutes, and not yet revealed
    expect(screen.queryByText(/94 minutes/i)).toBeNull()
    expect(screen.queryByText(/group!/i)).toBeNull()
  })

  it('result reveals the group once the taker\'s session has ended', async () => {
    localStorage.setItem('lya.personality.username', 'Mae')
    mockTakerSession = { id: 'sA', status: 'ended', timerMinutes: 15, startedAt: 0, groupsFrozenAt: null }
    mockTaker = completedTaker({ sessionId: 'sA', group: 'scavenger' })

    render(<TestApp />)
    expect(await screen.findByText(/you're in the scavenger hunt group!/i)).toBeInTheDocument()
    expect(screen.queryByText(/check back in/i)).toBeNull()
  })

  // Bug #2: a taker's browser must NEVER write the frozen-groups flag. Freezing is a
  // sessions write (admin-only by the rules); a client doing it off its own clock froze
  // fresh sessions early (clock skew / shared admin auth) -> premature group reveal.
  it('never freezes session groups from the client, even when its local timer reads 0', async () => {
    localStorage.setItem('lya.personality.username', 'Mae')
    mockNow = 9_999_999_999 // far future -> computeT(...) === 0 for the active session
    mockSession = { id: 's1', status: 'active', timerMinutes: 30, startedAt: 0, groupsFrozenAt: null }
    mockTakerSession = { id: 's1', status: 'active', timerMinutes: 30, startedAt: 0, groupsFrozenAt: null }
    mockTaker = completedTaker({ sessionId: 's1', group: null })

    render(<TestApp />)
    await waitFor(() => expect(screen.getByText('INTJ')).toBeInTheDocument())
    expect(freezeSessionGroups).not.toHaveBeenCalled()
  })

  // Bug #1: don't create an anonymous identity just by loading the page. A stray anonymous
  // session shares the browser's single Firebase Auth and clobbers the admin sign-in.
  it('does not sign in anonymously on the landing screen (no taker yet)', async () => {
    render(<TestApp />)
    expect(await screen.findByPlaceholderText(/username/i)).toBeInTheDocument()
    expect(ensureAnonymous).not.toHaveBeenCalled()
  })

  it('signs in anonymously BEFORE writing the taker doc when a test begins', async () => {
    render(<TestApp />)
    fireEvent.change(screen.getByPlaceholderText(/username/i), { target: { value: 'Mae' } })
    fireEvent.click(screen.getByRole('button', { name: /begin/i }))
    await waitFor(() => expect(upsertTaker).toHaveBeenCalled())
    expect(ensureAnonymous).toHaveBeenCalled()
    expect((ensureAnonymous as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0])
      .toBeLessThan((upsertTaker as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0])
  })

  it('signs in anonymously when resuming a stored taker on refresh', async () => {
    localStorage.setItem('lya.personality.username', 'Mae')
    mockTaker = { taker: { username: 'Mae', answers: { 1: 3 }, completed: false, type: null, axisScores: null, seRank: null, seStrength: null, sharing: false, sessionId: null, group: null, groupOverride: false }, loading: false }
    render(<TestApp />)
    await waitFor(() => expect(ensureAnonymous).toHaveBeenCalled())
  })

  it('passes uid + active session into the begin claim', async () => {
    mockSession = { id: 'sLive', status: 'active', timerMinutes: 30, startedAt: 0, groupsFrozenAt: null }
    render(<TestApp />)
    fireEvent.change(screen.getByPlaceholderText(/username/i), { target: { value: 'Mae' } })
    fireEvent.click(screen.getByRole('button', { name: /begin/i }))
    await waitFor(() => expect(upsertTaker).toHaveBeenCalledWith(
      expect.anything(), 'Mae', { ownerUid: 'uidA', sessionId: 'sLive' }))
  })

  it('shows the taken-name message and stays on landing when the name is claimed', async () => {
    ;(upsertTaker as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new UsernameTakenError('Mae'))
    render(<TestApp />)
    fireEvent.change(screen.getByPlaceholderText(/username/i), { target: { value: 'Mae' } })
    fireEvent.click(screen.getByRole('button', { name: /begin/i }))
    expect(await screen.findByText(/taken/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/username/i)).toBeInTheDocument()
  })
})
