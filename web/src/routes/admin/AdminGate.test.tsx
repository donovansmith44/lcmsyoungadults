import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('../../hooks/useIsAdmin', () => ({ useIsAdmin: () => mockState }))
let mockState: { user: unknown; admin: boolean; loading: boolean }

import { AdminGate } from './AdminGate'

describe('AdminGate', () => {
  it('shows sign-in when not authenticated', () => {
    mockState = { user: null, admin: false, loading: false }
    render(<AdminGate><div>secret</div></AdminGate>)
    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument()
    expect(screen.queryByText('secret')).not.toBeInTheDocument()
  })
  it('shows "not authorized" for a signed-in non-admin', () => {
    mockState = { user: { email: 'x@y.z' }, admin: false, loading: false }
    render(<AdminGate><div>secret</div></AdminGate>)
    expect(screen.getByText(/not authorized/i)).toBeInTheDocument()
    expect(screen.queryByText('secret')).not.toBeInTheDocument()
  })
  it('renders children for an allowlisted admin', () => {
    mockState = { user: { email: 'a@b.c' }, admin: true, loading: false }
    render(<AdminGate><div>secret</div></AdminGate>)
    expect(screen.getByText('secret')).toBeInTheDocument()
  })
})
