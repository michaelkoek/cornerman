// Firebase Auth — Google sign-in, with a React hook for the auth gate.
import { useEffect, useState } from 'react'
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  getRedirectResult,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth'
import { firebaseConfigured, getAuthInstance } from './firebase'

const provider = new GoogleAuthProvider()

/**
 * Google sign-in. Popup is the primary path — it works on localhost and on the
 * GitHub Pages origin, where `signInWithRedirect` breaks because the round-trip
 * through *.firebaseapp.com is treated as third-party storage and blocked by
 * modern browsers (bounces straight back to the login screen). Redirect is a
 * last resort only when a popup genuinely can't open.
 */
export async function signInWithGoogle(): Promise<void> {
  const auth = getAuthInstance()
  await setPersistence(auth, browserLocalPersistence)
  try {
    await signInWithPopup(auth, provider)
  } catch (err) {
    const code = (err as { code?: string }).code ?? ''
    // User closed / double-clicked the popup — not a real failure, just stop.
    if (code === 'auth/cancelled-popup-request' || code === 'auth/popup-closed-by-user') {
      return
    }
    if (
      code === 'auth/popup-blocked' ||
      code === 'auth/operation-not-supported-in-this-environment'
    ) {
      await signInWithRedirect(auth, provider)
      return
    }
    throw err
  }
}

/**
 * Completes a redirect-based sign-in (the fallback path) on app load and
 * surfaces any error. No-op for the popup path. Returns an error message to
 * show, or null.
 */
export async function completeRedirectSignIn(): Promise<string | null> {
  if (!firebaseConfigured) return null
  try {
    await getRedirectResult(getAuthInstance())
    return null
  } catch (err) {
    return err instanceof Error ? err.message : 'Sign-in failed. Try again.'
  }
}

export async function signOut(): Promise<void> {
  await fbSignOut(getAuthInstance())
}

export interface AuthState {
  user: User | null
  loading: boolean
  configured: boolean
}

/** Subscribes to Firebase auth state. */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: firebaseConfigured,
    configured: firebaseConfigured,
  })

  useEffect(() => {
    if (!firebaseConfigured) return
    const unsub = onAuthStateChanged(getAuthInstance(), (user) => {
      setState({ user, loading: false, configured: true })
    })
    return unsub
  }, [])

  return state
}
