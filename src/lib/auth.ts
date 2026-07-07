// Firebase Auth — Google sign-in, with a React hook for the auth gate.
import { useEffect, useState } from 'react'
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth'
import { firebaseConfigured, getAuthInstance } from './firebase'

const provider = new GoogleAuthProvider()

/** Coarse mobile check — popups are unreliable on mobile browsers. */
function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
}

/** Google sign-in: popup on desktop, redirect fallback on mobile / popup block. */
export async function signInWithGoogle(): Promise<void> {
  const auth = getAuthInstance()
  if (isMobile()) {
    await signInWithRedirect(auth, provider)
    return
  }
  try {
    await signInWithPopup(auth, provider)
  } catch (err) {
    // Popup blocked / closed / not supported → fall back to redirect.
    const code = (err as { code?: string }).code ?? ''
    if (
      code === 'auth/popup-blocked' ||
      code === 'auth/cancelled-popup-request' ||
      code === 'auth/operation-not-supported-in-this-environment'
    ) {
      await signInWithRedirect(auth, provider)
      return
    }
    throw err
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
