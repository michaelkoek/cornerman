// Firebase app / auth / firestore init for Cornerman.
//
// All VITE_FIREBASE_* values are PUBLIC client config (Firebase console →
// Project settings → Your apps → Web app). They are safe to ship in the bundle;
// access is gated by Firestore security rules, not by hiding the config.
//
// Init is guarded so a build without env (e.g. CI `vite build`) does not crash —
// the app renders a config-error state instead of throwing at import time.

import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

/** True when the minimum config needed to talk to Firebase is present. */
export const firebaseConfigured = Boolean(config.apiKey && config.projectId && config.appId)

let app: FirebaseApp | null = null
let authInstance: Auth | null = null
let dbInstance: Firestore | null = null

if (firebaseConfigured) {
  app = initializeApp(config)
  authInstance = getAuth(app)
  // Offline persistence (IndexedDB) so gym logging works with no signal.
  dbInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  })
}

/** Firestore instance. Throws if Firebase env config is missing. */
export function getDb(): Firestore {
  if (!dbInstance) throw new Error('Firebase is not configured. Set VITE_FIREBASE_* env vars.')
  return dbInstance
}

/** Auth instance. Throws if Firebase env config is missing. */
export function getAuthInstance(): Auth {
  if (!authInstance) throw new Error('Firebase is not configured. Set VITE_FIREBASE_* env vars.')
  return authInstance
}
