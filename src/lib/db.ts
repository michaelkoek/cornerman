// Firestore data layer for Cornerman — all reads/writes scoped to the current
// user's uid, per integrations/firestore-model.md. Exercises are NOT stored in
// Firestore; they are bundled reference data hydrated on read.

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import exercisesData from '../../data/exercises.json'
import type {
  Anchor,
  BodyweightEntry,
  Exercise,
  Session,
  SessionExercise,
  Settings,
  Sport,
} from '../../shared/types'
import { getAuthInstance, getDb } from './firebase'

// ---------------------------------------------------------------------------
// Bundled exercise reference data
// ---------------------------------------------------------------------------

const EXERCISES = exercisesData as Exercise[]
const EXERCISE_BY_ID = new Map(EXERCISES.map((e) => [e.id, e]))

export function getAllExercises(): Exercise[] {
  return EXERCISES
}

export function getExercise(id: string): Exercise | undefined {
  return EXERCISE_BY_ID.get(id)
}

// ---------------------------------------------------------------------------
// Date helpers (local timezone, Monday-based weeks) — mirror server/db.ts
// ---------------------------------------------------------------------------

export function todayStr(): string {
  return toIso(new Date())
}

export function toIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseIso(iso: string): Date {
  const [y = 1970, m = 1, d = 1] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(iso: string, days: number): string {
  const d = parseIso(iso)
  d.setDate(d.getDate() + days)
  return toIso(d)
}

/** Monday of the week containing `iso`. */
export function weekStart(iso: string): string {
  const d = parseIso(iso)
  const shift = (d.getDay() + 6) % 7 // Mon=0 .. Sun=6
  return toIso(new Date(d.getFullYear(), d.getMonth(), d.getDate() - shift))
}

// ---------------------------------------------------------------------------
// uid access
// ---------------------------------------------------------------------------

export function currentUid(): string {
  const uid = getAuthInstance().currentUser?.uid
  if (!uid) throw new Error('Not signed in.')
  return uid
}

export function newId(): string {
  return crypto.randomUUID()
}

// ---------------------------------------------------------------------------
// Session doc <-> Session hydration
// ---------------------------------------------------------------------------

/** Firestore session doc shape (exercises store exerciseId, not the full Exercise). */
interface StoredSessionExercise {
  id: string
  exerciseId: string
  order: number
  targetSets: number
  targetReps: [number, number]
  suggestedWeightKg: number | null
  sets: Session['exercises'][number]['sets']
}

/** Hydrate a Firestore session document into a full Session (with Exercise objects). */
export function hydrateSession(id: string, data: DocumentData): Session {
  const stored = (data.exercises ?? []) as StoredSessionExercise[]
  const exercises: SessionExercise[] = stored
    .map((se): SessionExercise | null => {
      const exercise = getExercise(se.exerciseId)
      if (!exercise) return null
      return {
        id: se.id,
        exerciseId: se.exerciseId,
        exercise,
        order: se.order,
        targetSets: se.targetSets,
        targetReps: se.targetReps,
        suggestedWeightKg: se.suggestedWeightKg ?? null,
        sets: se.sets ?? [],
      }
    })
    .filter((se): se is SessionExercise => se !== null)

  return {
    id,
    date: data.date,
    sport: data.sport,
    source: data.source,
    status: data.status,
    durationMin: data.durationMin ?? null,
    startedAt: data.startedAt ?? null,
    elapsedSec: data.elapsedSec ?? 0,
    rpe: data.rpe ?? null,
    note: data.note ?? null,
    location: data.location ?? null,
    machinesOnly: data.machinesOnly ?? false,
    distanceKm: data.distanceKm ?? null,
    avgPaceSecPerKm: data.avgPaceSecPerKm ?? null,
    avgHr: data.avgHr ?? null,
    stravaId: data.stravaId ?? null,
    run: (data.run as Session['run']) ?? null,
    exercises,
  }
}

/** Strip a Session down to the storable shape (exercises hold exerciseId only). */
export function toStored(session: Session): DocumentData {
  return {
    date: session.date,
    sport: session.sport,
    source: session.source,
    status: session.status,
    durationMin: session.durationMin,
    startedAt: session.startedAt,
    elapsedSec: session.elapsedSec,
    rpe: session.rpe,
    note: session.note,
    location: session.location,
    machinesOnly: session.machinesOnly,
    distanceKm: session.distanceKm,
    avgPaceSecPerKm: session.avgPaceSecPerKm,
    avgHr: session.avgHr,
    stravaId: session.stravaId,
    run: session.run,
    exercises: session.exercises.map(
      (se): StoredSessionExercise => ({
        id: se.id,
        exerciseId: se.exerciseId,
        order: se.order,
        targetSets: se.targetSets,
        targetReps: se.targetReps,
        suggestedWeightKg: se.suggestedWeightKg,
        sets: se.sets,
      }),
    ),
  }
}

function docToSession(snap: QueryDocumentSnapshot<DocumentData>): Session {
  return hydrateSession(snap.id, snap.data())
}

// ---------------------------------------------------------------------------
// Session queries
// ---------------------------------------------------------------------------

function sessionsCol() {
  return collection(getDb(), 'sessions')
}

// Single-user app with a tiny dataset: fetch all of the user's sessions with a
// single-field (uid) query — which Firestore auto-indexes — and do every filter,
// sort, and limit in JS. This deliberately avoids composite indexes entirely, so
// no "this query requires an index" prompts on any screen, and it plays nicer
// with the offline cache.
async function allUserSessions(): Promise<Session[]> {
  const uid = currentUid()
  const snap = await getDocs(query(sessionsCol(), where('uid', '==', uid)))
  const sessions = snap.docs.map(docToSession)
  // Newest date first; matches the old `date DESC` ordering.
  sessions.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  return sessions
}

/** All sessions for the current user, newest date first (History / Log). */
export async function listSessions(max = 100): Promise<Session[]> {
  return (await allUserSessions()).slice(0, max)
}

/** Done sessions on or after `fromDate`, for recovery/dashboard/week math. */
export async function doneSessionsSince(fromDate: string): Promise<Session[]> {
  return (await allUserSessions()).filter((s) => s.status === 'done' && s.date >= fromDate)
}

/** All-time done sessions, newest date first — PR / all-time-max math. */
export async function allDoneSessions(): Promise<Session[]> {
  return (await allUserSessions()).filter((s) => s.status === 'done')
}

/** All sessions on a specific date (any status). */
export async function sessionsOnDate(date: string): Promise<Session[]> {
  return (await allUserSessions()).filter((s) => s.date === date)
}

/** Recent done strength sessions (weightlifting/calisthenics), newest first. */
export async function recentStrengthSessions(max: number): Promise<Session[]> {
  return (await allUserSessions())
    .filter((s) => s.status === 'done')
    .filter((s) => s.sport === 'weightlifting' || s.sport === 'calisthenics')
    .slice(0, max)
}

export async function getSession(id: string): Promise<Session | null> {
  const snap = await getDoc(doc(getDb(), 'sessions', id))
  if (!snap.exists()) return null
  const data = snap.data()
  if (data.uid !== currentUid()) return null
  return hydrateSession(snap.id, data)
}

/** Create a session doc from a (client-built, id-less) Session shape. Returns the created Session. */
export async function createSessionDoc(session: Omit<Session, 'id'>): Promise<Session> {
  const uid = currentUid()
  const id = newId()
  const ref = doc(getDb(), 'sessions', id)
  await setDoc(ref, {
    uid,
    ...toStored({ ...session, id }),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return { ...session, id }
}

/** Overwrite a session's mutable fields (read-modify-write for embedded sets/exercises). */
export async function writeSession(session: Session): Promise<void> {
  const ref = doc(getDb(), 'sessions', session.id)
  await updateDoc(ref, { ...toStored(session), updatedAt: serverTimestamp() })
}

export async function deleteSession(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), 'sessions', id))
}

/** Delete any planned/in_progress sessions for `date` (suggest replaces the day's plan). */
export async function deletePlannedOnDate(date: string): Promise<void> {
  const sessions = await sessionsOnDate(date)
  await Promise.all(
    sessions
      .filter((s) => s.status === 'planned' || s.status === 'in_progress')
      .map((s) => deleteSession(s.id)),
  )
}

// ---------------------------------------------------------------------------
// Bodyweight — one doc per day per user, id `${uid}_${date}` so logging the
// same day twice overwrites (and an external sync can upsert idempotently).
// ---------------------------------------------------------------------------

function bodyweightCol() {
  return collection(getDb(), 'bodyweight')
}

/** All bodyweight entries for the current user, oldest first. */
export async function listBodyweight(): Promise<BodyweightEntry[]> {
  const uid = currentUid()
  const snap = await getDocs(query(bodyweightCol(), where('uid', '==', uid)))
  const entries = snap.docs.map((d) => {
    const data = d.data()
    return { id: d.id, date: data.date as string, weightKg: data.weightKg as number }
  })
  entries.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  return entries
}

/** Create or overwrite the entry for `date`. */
export async function upsertBodyweight(date: string, weightKg: number): Promise<BodyweightEntry> {
  const uid = currentUid()
  const id = `${uid}_${date}`
  await setDoc(
    doc(getDb(), 'bodyweight', id),
    { uid, date, weightKg, updatedAt: serverTimestamp() },
    { merge: true },
  )
  return { id, date, weightKg }
}

export async function deleteBodyweight(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), 'bodyweight', id))
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

const DEFAULT_ANCHORS: Omit<Anchor, 'id'>[] = [
  { weekday: 2, sport: 'kickboxing', time: '19:00', label: 'Kickboxing class' },
  { weekday: 4, sport: 'kickboxing', time: '19:00', label: 'Kickboxing class' },
]

function defaultSettings(uid: string): Settings & { uid: string } {
  return {
    uid,
    weeklyTarget: 4,
    anchors: DEFAULT_ANCHORS.map((a) => ({ ...a, id: newId() })),
    stravaConnected: false,
    stravaLastSyncAt: null,
  }
}

/** Read the settings doc, creating it with defaults on first sign-in. */
export async function getSettings(): Promise<Settings> {
  const uid = currentUid()
  const ref = doc(getDb(), 'settings', uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    const fresh = defaultSettings(uid)
    await setDoc(ref, fresh)
    return {
      weeklyTarget: fresh.weeklyTarget,
      anchors: fresh.anchors,
      stravaConnected: fresh.stravaConnected,
      stravaLastSyncAt: fresh.stravaLastSyncAt,
    }
  }
  const data = snap.data()
  return {
    weeklyTarget: data.weeklyTarget ?? 4,
    anchors: (data.anchors ?? []) as Anchor[],
    stravaConnected: Boolean(data.stravaConnected),
    stravaLastSyncAt: (data.stravaLastSyncAt as string | undefined) ?? null,
  }
}

export async function writeWeeklyTarget(weeklyTarget: number): Promise<Settings> {
  const uid = currentUid()
  const ref = doc(getDb(), 'settings', uid)
  await setDoc(ref, { weeklyTarget }, { merge: true })
  return getSettings()
}

export async function addAnchorDoc(input: Omit<Anchor, 'id'>): Promise<Anchor> {
  const current = await getSettings()
  const anchor: Anchor = { ...input, id: newId() }
  const uid = currentUid()
  await setDoc(
    doc(getDb(), 'settings', uid),
    { anchors: [...current.anchors, anchor] },
    { merge: true },
  )
  return anchor
}

export async function deleteAnchorDoc(id: string): Promise<void> {
  const current = await getSettings()
  const uid = currentUid()
  await setDoc(
    doc(getDb(), 'settings', uid),
    { anchors: current.anchors.filter((a) => a.id !== id) },
    { merge: true },
  )
}

// ---------------------------------------------------------------------------
// Week / streak helpers (shared by today + dashboard)
// ---------------------------------------------------------------------------

/** Count done sessions in the week starting Monday `ws`, from a pre-fetched list. */
export function doneCountForWeek(sessions: Session[], ws: string): number {
  const we = addDays(ws, 6)
  return sessions.filter((s) => s.status === 'done' && s.date >= ws && s.date <= we).length
}

/** Monday-first flags for the week starting `ws`: true where a done session exists. */
export function trainedDaysForWeek(sessions: Session[], ws: string): boolean[] {
  const we = addDays(ws, 6)
  const trained = new Set(
    sessions.filter((s) => s.status === 'done' && s.date >= ws && s.date <= we).map((s) => s.date)
  )
  return Array.from({ length: 7 }, (_, i) => trained.has(addDays(ws, i)))
}

/** Consecutive weeks hitting the weekly target (current week counts if already hit). */
export function computeStreakWeeks(sessions: Session[], target: number): number {
  if (target <= 0) return 0
  const currentWs = weekStart(todayStr())
  let ws = doneCountForWeek(sessions, currentWs) >= target ? currentWs : addDays(currentWs, -7)
  let streak = 0
  while (streak < 520 && doneCountForWeek(sessions, ws) >= target) {
    streak++
    ws = addDays(ws, -7)
  }
  return streak
}

export const SPORTS: Sport[] = [
  'kickboxing',
  'boxing',
  'running',
  'calisthenics',
  'weightlifting',
  'conditioning',
]
