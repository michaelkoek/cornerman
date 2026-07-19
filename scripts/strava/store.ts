// Firestore (Admin SDK) access for the Strava sync scripts.
// Reads env: FIREBASE_SERVICE_ACCOUNT (JSON key), CORNERMAN_UID.
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { IRunSessionDoc } from './map.ts';
import type { IStravaTokens } from './stravaClient.ts';

const TOKENS_DOC = 'integrations/strava';

export interface ISyncState extends IStravaTokens {
  lastSyncEpoch: number; // epoch seconds of the newest imported activity, 0 = never
}

export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var ${name}.`);
  }
  return value;
}

export function initFirestore(): Firestore {
  if (getApps().length === 0) {
    const serviceAccount = JSON.parse(requiredEnv('FIREBASE_SERVICE_ACCOUNT')) as Record<string, string>;
    initializeApp({ credential: cert(serviceAccount) });
  }
  return getFirestore();
}

export async function readSyncState(db: Firestore): Promise<ISyncState> {
  const snap = await db.doc(TOKENS_DOC).get();
  if (!snap.exists) {
    throw new Error(
      'No Strava tokens found in Firestore (integrations/strava). Run `npx tsx scripts/strava/authorize.ts` once.',
    );
  }
  const data = snap.data() ?? {};
  const accessToken = data.accessToken as string | undefined;
  const refreshToken = data.refreshToken as string | undefined;
  if (!accessToken || !refreshToken) {
    throw new Error('Strava token doc is incomplete. Re-run the authorize script.');
  }
  return {
    accessToken,
    refreshToken,
    expiresAt: Number(data.expiresAt ?? 0),
    lastSyncEpoch: Number(data.lastSyncEpoch ?? 0),
  };
}

export async function writeTokens(db: Firestore, tokens: IStravaTokens): Promise<void> {
  await db.doc(TOKENS_DOC).set(
    {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

export async function writeLastSyncEpoch(db: Firestore, epoch: number): Promise<void> {
  await db.doc(TOKENS_DOC).set({ lastSyncEpoch: epoch }, { merge: true });
}

/** True when a session for this Strava activity already exists (dedupe). */
export async function sessionExists(db: Firestore, uid: string, stravaId: string): Promise<boolean> {
  const snap = await db
    .collection('sessions')
    .where('uid', '==', uid)
    .where('stravaId', '==', stravaId)
    .limit(1)
    .get();
  return !snap.empty;
}

export async function createRunSession(db: Firestore, uid: string, session: IRunSessionDoc): Promise<void> {
  await db.collection('sessions').doc(crypto.randomUUID()).set({
    uid,
    ...session,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/** Mark Strava as connected and stamp the last successful sync on the settings doc. */
export async function markSynced(db: Firestore, uid: string): Promise<void> {
  await db.doc(`settings/${uid}`).set(
    {
      stravaConnected: true,
      stravaLastSyncAt: new Date().toISOString(),
    },
    { merge: true },
  );
}
