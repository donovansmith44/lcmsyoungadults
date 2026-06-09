import { describe, it, expect } from 'vitest'
import { sortSessionsByStartedDesc, sessionStartMillis } from './useSessions'
import type { SessionDoc } from '../data/sessions'

const mk = (id: string, startedAt: SessionDoc['startedAt']): SessionDoc => ({
  id, name: id, status: 'active', timerMinutes: 30, startedAt, endedAt: null, groupsFrozenAt: null, createdBy: 'a',
})

describe('sortSessionsByStartedDesc', () => {
  it('orders newest first and KEEPS a session whose startedAt is missing (does not drop it)', () => {
    const sorted = sortSessionsByStartedDesc([mk('old', 1000), mk('new', 5000), mk('pending', null)])
    expect(sorted.map((s) => s.id)).toEqual(['pending', 'new', 'old'])
    // the startedAt-less session must still be present — this is the bug we're guarding
    expect(sorted.some((s) => s.id === 'pending')).toBe(true)
  })

  it('treats a missing startedAt as newest', () => {
    expect(sessionStartMillis(null)).toBe(Number.POSITIVE_INFINITY)
    expect(sessionStartMillis(1234)).toBe(1234)
  })
})
