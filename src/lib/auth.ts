// Firebase Auth — email/password sign-in, with a React hook for the auth gate.
import { useEffect, useState } from 'react'
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth'
import { firebaseConfigured, getAuthInstance } from './firebase'

export async function signInWithEmail(email: string, password: string): Promise<void> {
  const auth = getAuthInstance()
  await setPersistence(auth, browserLocalPersistence)
  await signInWithEmailAndPassword(auth, email, password)
}

export async function signUpWithEmail(email: string, password: string): Promise<void> {
  const auth = getAuthInstance()
  await setPersistence(auth, browserLocalPersistence)
  await createUserWithEmailAndPassword(auth, email, password)
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
