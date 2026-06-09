import { describe, it, expect, vi, beforeEach } from 'vitest'

// Captured firebase/auth calls.
const signInWithPopup = vi.fn(() => Promise.resolve({ user: { email: 'a@b.c', uid: 'u1' } }))
const signOut = vi.fn(() => Promise.resolve())

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class {},
  signInWithPopup: (...a: unknown[]) => signInWithPopup(...a),
  signOut: (...a: unknown[]) => signOut(...a),
}))
// `auth.currentUser` is read lazily so each test can vary it.
vi.mock('../firebase', () => ({ auth: { get currentUser() { return mockCurrentUser } }, db: {} }))
vi.mock('../data/admins', () => ({ isAdminEmail: vi.fn(() => Promise.resolve(true)) }))

let mockCurrentUser: { isAnonymous: boolean } | null = null

import { signInWithGoogle } from './adminAuth'

describe('signInWithGoogle', () => {
  beforeEach(() => { vi.clearAllMocks(); mockCurrentUser = null })

  // Bug #1: the browser shares one Firebase Auth between the anonymous taker flow and the
  // Google admin sign-in. Replacing the anonymous session deterministically keeps admin
  // writes from executing under the anonymous (email-less) identity.
  it('signs out an existing anonymous session before the Google popup', async () => {
    mockCurrentUser = { isAnonymous: true }
    await signInWithGoogle()
    expect(signOut).toHaveBeenCalled()
    expect(signInWithPopup).toHaveBeenCalled()
    expect(signOut.mock.invocationCallOrder[0]).toBeLessThan(signInWithPopup.mock.invocationCallOrder[0])
  })

  it('does not sign out when there is no anonymous session to replace', async () => {
    mockCurrentUser = null
    await signInWithGoogle()
    expect(signOut).not.toHaveBeenCalled()
    expect(signInWithPopup).toHaveBeenCalled()
  })
})
