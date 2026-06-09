import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { auth, db } from '../firebase'
import { isAdminEmail } from '../data/admins'

export async function signInWithGoogle(): Promise<User> {
  // The browser shares one Firebase Auth between the anonymous taker flow and admin
  // sign-in. Drop any anonymous session first so the Google identity replaces it cleanly
  // and admin writes never execute under the email-less anonymous user.
  if (auth.currentUser?.isAnonymous) await signOut(auth)
  const cred = await signInWithPopup(auth, new GoogleAuthProvider())
  return cred.user
}

export function signOutAdmin(): Promise<void> {
  return signOut(auth)
}

/** True only if the signed-in user's email is on the allowlist. */
export async function isAdmin(user: User | null): Promise<boolean> {
  if (!user?.email) return false
  return isAdminEmail(db, user.email)
}
