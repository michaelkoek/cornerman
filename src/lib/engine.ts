// Cornerman — suggestion rule engine, ported to the browser from server/engine.ts.
// Reads recent sessions from Firestore, computes a plan (slot/selection rules live
// in shared/planning.ts), writes a planned session doc, and returns it hydrated.

import type {
  Exercise,
  Session,
  SessionExercise,
  SetLog,
  SuggestRequest,
  WorkoutSplit,
} from '../../shared/types'
import { buildSlots, filterPool, pickExercises } from '../../shared/planning'
import {
  allDoneSessions,
  createSessionDoc,
  deletePlannedOnDate,
  getAllExercises,
  newId,
  recentStrengthSessions,
  todayStr,
  addDays,
} from './db'

const CYCLE: WorkoutSplit[] = ['push', 'pull', 'legs']

export type YesterdayLoad = 'rest' | 'light' | 'moderate' | 'hard'

/** Recovery signal from yesterday's done sessions. */
export function computeYesterdayLoad(sessions: Session[], today: string = todayStr()): YesterdayLoad {
  const yesterday = addDays(today, -1)
  const rows = sessions.filter((s) => s.date === yesterday && s.status === 'done')
  if (rows.length === 0) return 'rest'
  const maxRpe = Math.max(...rows.map((r) => r.rpe ?? 0))
  const hardCombat = rows.some(
    (r) => (r.sport === 'kickboxing' || r.sport === 'boxing') && (r.durationMin ?? 0) >= 60,
  )
  if (maxRpe >= 8 || hardCombat) return 'hard'
  if (maxRpe >= 6) return 'moderate'
  return 'light'
}

/** Dominant push/pull/legs split of a session's exercises. */
function dominantSplit(session: Session): WorkoutSplit | null {
  const counts = new Map<WorkoutSplit, number>()
  for (const se of session.exercises) {
    const cat = se.exercise.category
    if (cat === 'push' || cat === 'pull' || cat === 'legs') {
      counts.set(cat, (counts.get(cat) ?? 0) + 1)
    }
  }
  let best: WorkoutSplit | null = null
  let bestN = 0
  for (const [cat, n] of counts) {
    if (n > bestN) {
      best = cat
      bestN = n
    }
  }
  return best
}

/** Next split in the push -> pull -> legs rotation based on the last done strength session. */
function nextSplit(recent: Session[]): WorkoutSplit {
  for (const s of recent) {
    const cat = dominantSplit(s)
    if (cat) return CYCLE[(CYCLE.indexOf(cat) + 1) % CYCLE.length]
  }
  return 'push'
}

/** Exercise ids used in the last 2 done strength sessions (variety exclusion). */
function recentlyUsedExerciseIds(recent: Session[]): Set<string> {
  const used = new Set<string>()
  for (const s of recent.slice(0, 2)) {
    for (const se of s.exercises) used.add(se.exerciseId)
  }
  return used
}

interface ProgressionResult {
  suggestedWeightKg: number | null
  targetReps: [number, number]
}

// After this long without doing a lift, recall the last weight but don't auto-
// progress on top of it — detraining means a stale max is already ambitious.
const STALE_DAYS = 60

/** Progression: based on the last done session-exercise of the same exercise. */
function progressionFor(ex: Exercise, doneSessions: Session[]): ProgressionResult {
  const [baseLow, baseHigh] = ex.repRange

  // Find the most recent done session-exercise for this exercise that has a done set.
  // doneSessions are pre-sorted newest date first.
  let lastSe: SessionExercise | null = null
  let lastDate: string | null = null
  outer: for (const s of doneSessions) {
    for (const se of s.exercises) {
      if (se.exerciseId === ex.id && se.sets.some((st) => st.done)) {
        lastSe = se
        lastDate = s.date
        break outer
      }
    }
  }

  if (!lastSe) {
    return { suggestedWeightKg: null, targetReps: [baseLow, baseHigh] }
  }

  const doneSets = lastSe.sets.filter((st) => st.done)
  const stale = lastDate !== null && lastDate < addDays(todayStr(), -STALE_DAYS)

  if (ex.type === 'weighted') {
    const weights = doneSets
      .map((s) => s.weightKg)
      .filter((w): w is number => w !== null && w !== undefined)
    if (weights.length === 0) {
      return { suggestedWeightKg: null, targetReps: [baseLow, baseHigh] }
    }
    const lastWeight = Math.max(...weights)
    const allTopped = doneSets.every((s) => s.reps >= baseHigh)
    return {
      // Recall the weight even after a long gap, but skip the +2.5 bump when stale.
      suggestedWeightKg: allTopped && !stale ? lastWeight + 2.5 : lastWeight,
      targetReps: [baseLow, baseHigh],
    }
  }

  // Bodyweight (and timed): progress by shifting target reps up, capped at +4 over the base range.
  const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi)
  let low = clamp(lastSe.targetReps[0], baseLow, baseLow + 4)
  let high = clamp(lastSe.targetReps[1], baseHigh, baseHigh + 4)
  const allTopped = doneSets.length > 0 && doneSets.every((s) => s.reps >= high)
  if (allTopped) {
    low = Math.min(low + 1, baseLow + 4)
    high = Math.min(high + 1, baseHigh + 4)
  }
  return { suggestedWeightKg: null, targetReps: [low, high] }
}

/** Build a full SessionExercise (with generated sets) for a picked exercise. */
function buildSessionExercise(
  e: Exercise,
  order: number,
  targetSets: number,
  prog: ProgressionResult,
): SessionExercise {
  const sets: SetLog[] = []
  for (let n = 1; n <= targetSets; n++) {
    sets.push({
      id: newId(),
      setNumber: n,
      reps: e.type === 'timed' ? 0 : prog.targetReps[0],
      weightKg: prog.suggestedWeightKg,
      seconds: e.type === 'timed' ? prog.targetReps[0] : null,
      done: false,
    })
  }
  return {
    id: newId(),
    exerciseId: e.id,
    exercise: e,
    order,
    targetSets,
    targetReps: prog.targetReps,
    suggestedWeightKg: prog.suggestedWeightKg,
    sets,
  }
}

/** Generate + persist a planned strength session for today. Returns the full Session. */
export async function suggestSession(req: SuggestRequest): Promise<Session> {
  const { minutes, location } = req
  const today = todayStr()

  // All-time done history (newest first): recovery only looks at yesterday,
  // and progression should recall a weight even if the lift was months ago.
  const doneSessions = await allDoneSessions()
  const load = computeYesterdayLoad(doneSessions, today)
  const hard = load === 'hard'

  const recentStrength = await recentStrengthSessions(5)

  // Replace any existing planned/in_progress session for today.
  await deletePlannedOnDate(today)

  const split = req.split ?? nextSplit(recentStrength)
  const slots = buildSlots(minutes, split, req.focus)
  const used = recentlyUsedExerciseIds(recentStrength)
  const pool = filterPool(getAllExercises(), location, hard)
  const picked = pickExercises(slots, pool, hard, used)

  const allBodyweight = picked.every((e) => e.type !== 'weighted')
  const sport = allBodyweight ? 'calisthenics' : 'weightlifting'

  const setsPerExercise = (e: Exercise): number => {
    if (minutes !== 60) return 3
    return e.category === 'core' || e.category === 'conditioning' ? 3 : 4
  }

  const exercises: SessionExercise[] = picked.map((e, i) => {
    const prog = progressionFor(e, doneSessions)
    return buildSessionExercise(e, i + 1, setsPerExercise(e), prog)
  })

  const session: Omit<Session, 'id'> = {
    date: today,
    sport,
    source: 'generated',
    status: 'planned',
    durationMin: minutes,
    rpe: null,
    note: null,
    location,
    distanceKm: null,
    avgPaceSecPerKm: null,
    avgHr: null,
    stravaId: null,
    run: null,
    exercises,
  }

  return createSessionDoc(session)
}

/** Progression info for a single exercise added manually to a session. */
export async function progressionForExercise(ex: Exercise): Promise<ProgressionResult> {
  return progressionFor(ex, await allDoneSessions())
}

/** Build a SessionExercise to add to an existing session (manual add / swap). */
export async function buildAddedExercise(ex: Exercise, order: number): Promise<SessionExercise> {
  const prog = await progressionForExercise(ex)
  return buildSessionExercise(ex, order, 3, prog)
}

/**
 * Swap candidates: fits location, not already in the session. Spans every
 * category — the swap sheet narrows by split (push/pull/legs), search and
 * muscle group client-side.
 */
export function alternativesFor(session: Session): Exercise[] {
  const inSession = new Set(session.exercises.map((x) => x.exerciseId))
  const location = session.location
  return getAllExercises().filter(
    (e) =>
      !inSession.has(e.id) &&
      (location === null || location === 'gym' || e.location.includes(location)),
  )
}
