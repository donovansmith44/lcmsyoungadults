import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

// Mock only the data writes the End button triggers (leave firebase/useIsAdmin real,
// as the other tests rely on them).
vi.mock('../../data/freeze', () => ({ freezeSessionGroups: vi.fn(() => Promise.resolve()) }))
vi.mock('../../data/sessions', () => ({
  startSession: vi.fn(() => Promise.resolve('new')),
  endSession: vi.fn(() => Promise.resolve()),
  archiveSession: vi.fn(() => Promise.resolve()),
}))

import { SessionList } from './SessionList'
import { endSession } from '../../data/sessions'
import { freezeSessionGroups } from '../../data/freeze'
import type { SessionDoc } from '../../data/sessions'

const active: SessionDoc = { id: 's1', name: 'Day', status: 'active', timerMinutes: 30, startedAt: 1, endedAt: null, groupsFrozenAt: null, createdBy: 'a@b.c' }

describe('SessionList', () => {
  it('disables Start while a session is active', () => {
    render(<SessionList sessions={[active]} onSelect={() => {}} selectedId="s1" />)
    expect(screen.getByRole('button', { name: /start session/i })).toBeDisabled()
  })

  it('enables Start when none is active and passes name + timer', () => {
    const onStart = vi.fn()
    render(<SessionList sessions={[]} onSelect={() => {}} selectedId={null} onStartOverride={onStart} />)
    fireEvent.change(screen.getByPlaceholderText(/session name/i), { target: { value: 'Personality Day' } })
    fireEvent.change(screen.getByLabelText(/timer/i), { target: { value: '20' } })
    fireEvent.click(screen.getByRole('button', { name: /start session/i }))
    expect(onStart).toHaveBeenCalledWith('Personality Day', 20)
  })

  it('End reveals groups then ends the session (freeze-then-end)', async () => {
    render(<SessionList sessions={[active]} onSelect={() => {}} selectedId="s1" />)
    fireEvent.click(screen.getByRole('button', { name: /^end$/i }))
    expect(freezeSessionGroups).toHaveBeenCalledWith(expect.anything(), 's1')
    await waitFor(() => expect(endSession).toHaveBeenCalledWith(expect.anything(), 's1'))
  })
})
