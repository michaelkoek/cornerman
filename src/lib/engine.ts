// Cornerman — suggestion rule engine, ported to the browser from server/engine.ts.
// suggest({minutes, location}) reads recent sessions from Firestore, computes a
// plan, writes a new planned session doc, and returns it (exercises hydrated).
//
// The rules (rotation / recovery / selection / progression) are faithful to the
// server version; the only change is data access — SQLite queries become
// operations over in-memory Session objects.

import type {
  Exercise,
  ExerciseCategory,
  Session,
  SessionExercise,
  SetLog,
  SuggestRequest,
} from '../../shared/types'
import {
  createSessionDoc,
  deletePlannedOnDate,
  doneSessionsSince,
  getAllExercises,
  newId,
  recentStrengthSessions,
  todayStr,
  addDays,
} from './db'

const CYCLE: ExerciseCategory[] = ['push', 'pull', 'legs']

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

/** Dominant push/pull/legs category of a session's exercises. */
function dominantCategory(session: Session): ExerciseCategory | null {
  const counts = new Map<ExerciseCategory, number>()
  for (const se of session.exercises) {
    const cat = se.exercise.category
    if (cat === 'push' || cat === 'pull' || cat === 'legs') {
      counts.set(cat, (counts.get(cat) ?? 0) + 1)
    }
  }
  let best: ExerciseCategory | null = null
  let bestN = 0
  for (const [cat, n] of counts) {
    if (n > bestN) {
      best = cat
      bestN = n
    }
  }
  return best
}

/** Next category in the push -> pull -> legs rotation based on the last done strength session. */
function nextCategory(recent: Session[]): ExerciseCategory {
  for (const s of recent) {
    const cat = dominantCategory(s)
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

function isLegsHeavyCompound(e: Exercise): boolean {
  if (e.category !== 'legs') return false
  const key = `${e.id} ${e.name}`.toLowerCase()
  return key.includes('deadlift') || key.includes('squat')
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

interface ProgressionResult {
  suggestedWeightKg: number | null
  targetReps: [number, number]
}

/** Progression: based on the last done session-exercise of the same exercise. */
function progressionFor(ex: Exercise, doneSessions: Session[]): ProgressionResult {
  const [baseLow, baseHigh] = ex.repRange

  // Find the most recent done session-exercise for this exercise that has a done set.
  // doneSessions are pre-sorted newest date first.
  let lastSe: SessionExercise | null = null
  outer: for (const s of doneSessions) {
    for (const se of s.exercises) {
      if (se.exerciseId === ex.id && se.sets.some((st) => st.done)) {
        lastSe = se
        break outer
      }
    }
  }

  if (!lastSe) {
    return { suggestedWeightKg: null, targetReps: [baseLow, baseHigh] }
  }

  const doneSets = lastSe.sets.filter((st) => st.done)

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
      suggestedWeightKg: allTopped ? lastWeight + 2.5 : lastWeight,
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

interface Slot {
  category: ExerciseCategory
  count: number
}

function planSlots(
  minutes: SuggestRequest['minutes'],
  recent: Session[],
): { slots: Slot[]; totalTarget: number } {
  const first = nextCategory(recent)
  const second = CYCLE[(CYCLE.indexOf(first) + 1) % CYCLE.length]
  const third = CYCLE[(CYCLE.indexOf(first) + 2) % CYCLE.length]
  if (minutes === 20) {
    return { slots: [{ category: first, count: 3 }], totalTarget: 3 }
  }
  if (minutes === 45) {
    return {
      slots: [
        { category: first, count: 2 },
        { category: second, count: 2 },
        { category: 'core', count: 1 },
      ],
      totalTarget: 5,
    }
  }
  // 60 minutes: full push/pull/legs coverage + core + conditioning finisher (6-7 exercises)
  return {
    slots: [
      { category: first, count: 2 },
      { category: second, count: 2 },
      { category: third, count: 1 },
      { category: 'core', count: 1 },
      { category: 'conditioning', count: 1 },
    ],
    totalTarget: 7,
  }
}

/** Build the ordered set of picked exercises for a plan (pure). */
function pickExercises(
  slots: Slot[],
  location: SuggestRequest['location'],
  hard: boolean,
  used: Set<string>,
): Exercise[] {
  let pool = getAllExercises().filter((e) =>
    location === 'gym' ? true : e.location.includes('home'),
  )
  if (hard) {
    pool = pool.filter((e) => e.difficulty !== 3 && !isLegsHeavyCompound(e))
  }

  const picked: Exercise[] = []
  const pickedIds = new Set<string>()

  for (const slot of slots) {
    let candidates = pool.filter(
      (e) => e.category === slot.category && !pickedIds.has(e.id) && !used.has(e.id),
    )
    if (candidates.length < slot.count) {
      candidates = pool.filter((e) => e.category === slot.category && !pickedIds.has(e.id))
    }
    const sorted = shuffle(candidates).sort((a, b) => {
      const compound = Number(b.muscleGroups.length >= 3) - Number(a.muscleGroups.length >= 3)
      if (compound !== 0) return compound
      if (hard) return a.difficulty - b.difficulty
      return 0
    })
    for (const e of sorted.slice(0, slot.count)) {
      picked.push(e)
      pickedIds.add(e.id)
    }
  }
  return picked
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

  // Recent history for recovery, rotation, variety, progression (~last 12 weeks of done work).
  const doneSessions = (await doneSessionsSince(addDays(today, -84))).sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : 0,
  )
  const load = computeYesterdayLoad(doneSessions, today)
  const hard = load === 'hard'

  const recentStrength = await recentStrengthSessions(5)

  // Replace any existing planned/in_progress session for today.
  await deletePlannedOnDate(today)

  const { slots } = planSlots(minutes, recentStrength)
  const used = recentlyUsedExerciseIds(recentStrength)
  const picked = pickExercises(slots, location, hard, used)

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
    exercises,
  }

  return createSessionDoc(session)
}

/** Progression info for a single exercise added manually to a session. */
export async function progressionForExercise(ex: Exercise): Promise<ProgressionResult> {
  const doneSessions = (await doneSessionsSince(addDays(todayStr(), -84))).sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : 0,
  )
  return progressionFor(ex, doneSessions)
}

/** Build a SessionExercise to add to an existing session (manual add / swap). */
export async function buildAddedExercise(ex: Exercise, order: number): Promise<SessionExercise> {
  const prog = await progressionForExercise(ex)
  return buildSessionExercise(ex, order, 3, prog)
}

/** Alternatives: same category, fits location, not already in the session. */
export function alternativesFor(session: Session, se: SessionExercise): Exercise[] {
  const current = se.exercise
  const inSession = new Set(session.exercises.map((x) => x.exerciseId))
  const location = session.location
  return getAllExercises().filter(
    (e) =>
      e.category === current.category &&
      !inSession.has(e.id) &&
      (location === null || location === 'gym' || e.location.includes(location)),
  )
}
