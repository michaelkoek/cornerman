// Client data interface. Same exported `api` object shape/method names as the
// old fetch wrapper, but backed by Firestore + the in-browser rule engine.
//
// Notable signature changes from the SQLite/HTTP version:
// - all ids are strings (Firestore / uuid)
// - updateSet(sessionId, setId, patch) — sets are embedded in the session doc,
//   so mutating one needs its owning session id (read-modify-write).
// - stravaAuthUrl / stravaSync are gone (Strava is synced by n8n now).

import type {
  Anchor,
  BodyweightResponse,
  CreateSessionRequest,
  DashboardResponse,
  Exercise,
  ExerciseCategory,
  ExerciseHistoryResponse,
  Location,
  Session,
  SessionExercise,
  SetLog,
  Settings,
  Sport,
  SuggestRequest,
  TodayResponse,
} from '../../shared/types'
import {
  addAnchorDoc,
  addDays,
  allDoneSessions,
  computeStreakWeeks,
  createSessionDoc,
  deleteAnchorDoc,
  deleteBodyweight,
  deleteSession as dbDeleteSession,
  doneCountForWeek,
  getAllExercises,
  getExercise,
  getSession,
  getSettings,
  listBodyweight,
  listSessions as dbListSessions,
  newId,
  sessionsOnDate,
  todayStr,
  upsertBodyweight,
  weekStart,
  writeSession,
  writeWeeklyTarget,
} from './db'
import {
  alternativesFor,
  buildAddedExercise,
  computeYesterdayLoad,
  suggestSession,
} from './engine'
import { computePRs, emptyPR, epley, foldSet } from './prs'

export interface SessionPatch {
  status?: Session['status']
  date?: string
  sport?: Sport
  rpe?: number
  note?: string | null
  durationMin?: number
  startedAt?: number | null
  elapsedSec?: number
}

export interface SetPatch {
  reps?: number
  weightKg?: number | null
  seconds?: number | null
  done?: boolean
}

// ---------------------------------------------------------------------------
// today
// ---------------------------------------------------------------------------

async function today(): Promise<TodayResponse> {
  const date = todayStr()
  const settings = await getSettings()
  const target = settings.weeklyTarget

  const weekday = new Date().getDay()
  const anchor = settings.anchors.find((a) => a.weekday === weekday) ?? null

  // Today's active/planned/done session — prefer in_progress > planned > done.
  const onDate = await sessionsOnDate(date)
  const rank: Record<Session['status'], number> = {
    in_progress: 0,
    planned: 1,
    done: 2,
    skipped: 3,
  }
  const candidate = onDate
    .filter((s) => s.status === 'in_progress' || s.status === 'planned' || s.status === 'done')
    .sort((a, b) => rank[a.status] - rank[b.status])[0]

  // All-time done history: recovery/week/streak math windows itself, and the
  // full history doubles as the PR baseline for in-workout celebration.
  const doneSessions = await allDoneSessions()
  const ws = weekStart(date)

  // PR baselines are only consumed by the active-workout view, so skip the
  // all-history PR pass on days with nothing to log (the landing screen).
  const active = candidate && candidate.status !== 'done'

  return {
    date,
    anchor,
    session: candidate ?? null,
    yesterdayLoad: computeYesterdayLoad(doneSessions, date),
    weekSessions: doneCountForWeek(doneSessions, ws),
    weeklyTarget: target,
    streakWeeks: computeStreakWeeks(doneSessions, target),
    prBaselines: active ? Object.fromEntries(computePRs(doneSessions)) : undefined,
  }
}

// ---------------------------------------------------------------------------
// sessions CRUD
// ---------------------------------------------------------------------------

async function createSession(body: CreateSessionRequest): Promise<Session> {
  const session: Omit<Session, 'id'> = {
    date: body.date,
    sport: body.sport,
    source: 'manual',
    status: body.status ?? 'done',
    durationMin: body.durationMin ?? null,
    startedAt: null,
    elapsedSec: 0,
    rpe: body.rpe ?? null,
    note: body.note ?? null,
    location: null,
    distanceKm: null,
    avgPaceSecPerKm: null,
    avgHr: null,
    stravaId: null,
    run: null,
    exercises: [],
  }
  return createSessionDoc(session)
}

async function updateSession(id: string, body: SessionPatch): Promise<Session> {
  const existing = await getSession(id)
  if (!existing) throw new Error('Session not found')
  const next: Session = {
    ...existing,
    status: body.status ?? existing.status,
    date: body.date ?? existing.date,
    sport: body.sport ?? existing.sport,
    rpe: body.rpe !== undefined ? body.rpe : existing.rpe,
    note: body.note !== undefined ? body.note : existing.note,
    durationMin: body.durationMin !== undefined ? body.durationMin : existing.durationMin,
    startedAt: body.startedAt !== undefined ? body.startedAt : existing.startedAt,
    elapsedSec: body.elapsedSec !== undefined ? body.elapsedSec : existing.elapsedSec,
  }
  await writeSession(next)
  return next
}

// ---------------------------------------------------------------------------
// sets & exercises inside a session
// ---------------------------------------------------------------------------

async function updateSet(sessionId: string, setId: string, body: SetPatch): Promise<SetLog> {
  const session = await getSession(sessionId)
  if (!session) throw new Error('Session not found')
  let updated: SetLog | null = null
  const next: Session = {
    ...session,
    exercises: session.exercises.map((se) => ({
      ...se,
      sets: se.sets.map((s) => {
        if (s.id !== setId) return s
        updated = {
          ...s,
          reps: body.reps !== undefined ? body.reps : s.reps,
          weightKg: body.weightKg !== undefined ? body.weightKg : s.weightKg,
          seconds: body.seconds !== undefined ? body.seconds : s.seconds,
          done: body.done !== undefined ? body.done : s.done,
        }
        return updated
      }),
    })),
  }
  if (!updated) throw new Error('Set not found')
  await writeSession(next)
  return updated
}

async function addSessionExercise(sessionId: string, exerciseId: string): Promise<SessionExercise> {
  const session = await getSession(sessionId)
  if (!session) throw new Error('Session not found')
  const exercise = getAllExercises().find((e) => e.id === exerciseId)
  if (!exercise) throw new Error('Unknown exerciseId')
  const order = session.exercises.reduce((max, e) => Math.max(max, e.order), 0) + 1
  const se = await buildAddedExercise(exercise, order)
  await writeSession({ ...session, exercises: [...session.exercises, se] })
  return se
}

async function removeSessionExercise(sessionId: string, sessionExerciseId: string): Promise<void> {
  const session = await getSession(sessionId)
  if (!session) throw new Error('Session not found')
  await writeSession({
    ...session,
    exercises: session.exercises.filter((se) => se.id !== sessionExerciseId),
  })
}

async function alternatives(sessionId: string): Promise<Exercise[]> {
  const session = await getSession(sessionId)
  if (!session) throw new Error('Session not found')
  return alternativesFor(session)
}

// ---------------------------------------------------------------------------
// exercises
// ---------------------------------------------------------------------------

function exercises(filters?: { location?: Location; category?: ExerciseCategory }): Promise<Exercise[]> {
  let list = getAllExercises()
  if (filters?.location === 'home') list = list.filter((e) => e.location.includes('home'))
  if (filters?.category) list = list.filter((e) => e.category === filters.category)
  return Promise.resolve(list)
}

// ---------------------------------------------------------------------------
// dashboard
// ---------------------------------------------------------------------------

/** Top done set per date (heaviest, then most reps), oldest first. */
function topSetPoints(
  points: { date: string; w: number; reps: number }[],
): { date: string; topSetKg: number; est1Rm: number; reps: number }[] {
  const byDate = new Map<string, { w: number; reps: number }>()
  for (const p of points) {
    const cur = byDate.get(p.date)
    if (!cur || p.w > cur.w || (p.w === cur.w && p.reps > cur.reps)) {
      byDate.set(p.date, { w: p.w, reps: p.reps })
    }
  }
  return [...byDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([date, top]) => ({
      date,
      topSetKg: top.w,
      est1Rm: epley(top.w, top.reps),
      reps: top.reps,
    }))
}

async function dashboard(): Promise<DashboardResponse> {
  const today = todayStr()
  const currentWs = weekStart(today)
  const settings = await getSettings()

  // All-time done sessions: PRs and lift progression are "all-time max";
  // weekly volume windows itself to 12 weeks below.
  const doneSessions = await allDoneSessions()

  // Weekly volume: minutes per sport, last 12 weeks (oldest first).
  const weeklyVolume: DashboardResponse['weeklyVolume'] = []
  for (let i = 11; i >= 0; i--) {
    const ws = addDays(currentWs, -7 * i)
    const we = addDays(ws, 6)
    const inWeek = doneSessions.filter((s) => s.date >= ws && s.date <= we)
    const bySport: Partial<Record<Sport, number>> = {}
    for (const s of inWeek) {
      bySport[s.sport] = (bySport[s.sport] ?? 0) + (s.durationMin ?? 0)
    }
    weeklyVolume.push({ weekStart: ws, bySport })
  }

  // Lift progression: top 6 most-logged weighted exercises (by distinct done sessions).
  interface Point {
    date: string
    w: number
    reps: number
  }
  const perExercise = new Map<string, { name: string; sessionDates: Set<string>; points: Point[] }>()
  for (const session of doneSessions) {
    for (const se of session.exercises) {
      if (se.exercise.type !== 'weighted') continue
      // weightKg > 0 (not just non-null) to match prs.ts/exerciseHistory — a
      // 0 kg placeholder set must not plot a 0-kg point or a phantom PR.
      const doneWeighted = se.sets.filter((s) => s.done && s.weightKg != null && s.weightKg > 0)
      if (doneWeighted.length === 0) continue
      let entry = perExercise.get(se.exerciseId)
      if (!entry) {
        entry = { name: se.exercise.name, sessionDates: new Set(), points: [] }
        perExercise.set(se.exerciseId, entry)
      }
      entry.sessionDates.add(session.id)
      for (const s of doneWeighted) {
        entry.points.push({ date: session.date, w: s.weightKg as number, reps: s.reps })
      }
    }
  }

  const rankedLifts = [...perExercise.entries()].sort(
    (a, b) => b[1].sessionDates.size - a[1].sessionDates.size || a[1].name.localeCompare(b[1].name),
  )

  const prs = computePRs(doneSessions)

  const liftProgression: DashboardResponse['liftProgression'] = rankedLifts
    .slice(0, 6)
    .map(([exerciseId, entry]) => ({
      exerciseId,
      name: entry.name,
      points: topSetPoints(entry.points),
      pr: prs.get(exerciseId),
    }))

  const allLifts: DashboardResponse['allLifts'] = rankedLifts.map(([exerciseId, entry]) => {
    const pr = prs.get(exerciseId)
    // doneSessions is newest-first, so the first point pushed is the latest.
    const lastDate = entry.points[0]?.date ?? ''
    return {
      exerciseId,
      name: entry.name,
      sessions: entry.sessionDates.size,
      maxWeightKg: pr?.maxWeightKg ?? null,
      bestEst1Rm: pr?.bestEst1Rm ?? null,
      lastDate,
    }
  })

  const monthPrefix = today.slice(0, 7)
  const sessionsThisMonth = doneSessions.filter((s) => s.date.startsWith(monthPrefix)).length

  return {
    weeklyVolume,
    liftProgression,
    streakWeeks: computeStreakWeeks(doneSessions, settings.weeklyTarget),
    sessionsThisMonth,
    allLifts,
  }
}

// ---------------------------------------------------------------------------
// exercise history (Progress drill-in)
// ---------------------------------------------------------------------------

async function exerciseHistory(exerciseId: string): Promise<ExerciseHistoryResponse> {
  const exercise = getExercise(exerciseId)
  if (!exercise) {
    throw new Error('Unknown exerciseId')
  }

  const doneSessions = await allDoneSessions() // newest first
  const rawPoints: { date: string; w: number; reps: number }[] = []
  const recent: ExerciseHistoryResponse['recent'] = []
  // Fold only this exercise's sets (oldest-first) into one PR — no need to
  // build the whole per-exercise map just to read a single entry.
  let pr = emptyPR(exerciseId)

  for (let i = doneSessions.length - 1; i >= 0; i--) {
    const session = doneSessions[i]
    const doneSets = session.exercises
      .filter((se) => se.exerciseId === exerciseId)
      .flatMap((se) => se.sets.filter((s) => s.done))
    if (doneSets.length === 0) {
      continue
    }
    for (const s of doneSets) {
      pr = foldSet(pr, exercise.type, { reps: s.reps, weightKg: s.weightKg, seconds: s.seconds }, session.date)
      if (s.weightKg != null && s.weightKg > 0) {
        rawPoints.push({ date: session.date, w: s.weightKg, reps: s.reps })
      }
    }
  }

  // recent = last 5 sessions, newest first.
  for (const session of doneSessions) {
    if (recent.length >= 5) {
      break
    }
    const doneSets = session.exercises
      .filter((se) => se.exerciseId === exerciseId)
      .flatMap((se) => se.sets.filter((s) => s.done))
    if (doneSets.length === 0) {
      continue
    }
    recent.push({
      date: session.date,
      sets: doneSets.map((s) => ({ reps: s.reps, weightKg: s.weightKg, seconds: s.seconds })),
    })
  }

  return { exercise, pr, points: topSetPoints(rawPoints), recent }
}

// ---------------------------------------------------------------------------
// bodyweight
// ---------------------------------------------------------------------------

const round1 = (v: number) => Math.round(v * 10) / 10

async function bodyweight(): Promise<BodyweightResponse> {
  const entries = await listBodyweight()
  const today = todayStr()
  const current = entries[entries.length - 1] ?? null

  const week = entries.filter((e) => e.date >= addDays(today, -6))
  const avg7dKg = week.length
    ? round1(week.reduce((sum, e) => sum + e.weightKg, 0) / week.length)
    : null

  // Baseline for the 30-day delta: the most recent entry at least 30 days old,
  // falling back to the earliest entry when history is shorter than that.
  const cutoff = addDays(today, -30)
  let baseline = entries[0] ?? null
  for (const e of entries) {
    if (e.date <= cutoff) baseline = e
    else break
  }
  const delta30dKg =
    current && baseline && baseline.id !== current.id
      ? round1(current.weightKg - baseline.weightKg)
      : null

  return {
    entries,
    currentKg: current?.weightKg ?? null,
    avg7dKg,
    delta30dKg,
    minKg: entries.length ? Math.min(...entries.map((e) => e.weightKg)) : null,
    maxKg: entries.length ? Math.max(...entries.map((e) => e.weightKg)) : null,
  }
}

// ---------------------------------------------------------------------------
// settings & anchors
// ---------------------------------------------------------------------------

function updateSettings(body: { weeklyTarget: number }): Promise<Settings> {
  const wt = Math.round(body.weeklyTarget)
  return writeWeeklyTarget(wt)
}

function addAnchor(body: {
  weekday: number
  sport: Sport
  time: string
  label: string
}): Promise<Anchor> {
  return addAnchorDoc(body)
}

// ---------------------------------------------------------------------------
// public api — same shape/names the screens already use
// ---------------------------------------------------------------------------

export const api = {
  // Today / planning
  today,
  suggest: (body: SuggestRequest) => suggestSession(body),

  // Sessions
  listSessions: () => dbListSessions(),
  createSession,
  updateSession,
  deleteSession: (id: string) => dbDeleteSession(id),

  // Sets & exercises inside a session
  updateSet,
  addSessionExercise,
  removeSessionExercise,
  alternatives,

  // Exercise library
  exercises,

  // Dashboard
  dashboard,
  exerciseHistory,

  // Bodyweight
  bodyweight,
  logWeight: (date: string, weightKg: number) => upsertBodyweight(date, weightKg),
  deleteWeight: (id: string) => deleteBodyweight(id),

  // Settings & anchors
  settings: () => getSettings(),
  updateSettings,
  addAnchor,
  deleteAnchor: (id: string) => deleteAnchorDoc(id),
}

// Re-exported so callers that generate ids locally (optimistic) stay consistent.
export { newId }
