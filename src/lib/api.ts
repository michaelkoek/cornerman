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
  CreateSessionRequest,
  DashboardResponse,
  Exercise,
  ExerciseCategory,
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
  computeStreakWeeks,
  createSessionDoc,
  deleteAnchorDoc,
  deleteSession as dbDeleteSession,
  doneCountForWeek,
  doneSessionsSince,
  getAllExercises,
  getSession,
  getSettings,
  listSessions as dbListSessions,
  newId,
  sessionsOnDate,
  todayStr,
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

export interface SessionPatch {
  status?: Session['status']
  rpe?: number
  note?: string
  durationMin?: number
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

  // Done history for recovery signal + week count + streak (last ~1 year for streak).
  const doneSessions = await doneSessionsSince(addDays(date, -400))
  const ws = weekStart(date)

  return {
    date,
    anchor,
    session: candidate ?? null,
    yesterdayLoad: computeYesterdayLoad(doneSessions, date),
    weekSessions: doneCountForWeek(doneSessions, ws),
    weeklyTarget: target,
    streakWeeks: computeStreakWeeks(doneSessions, target),
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
    rpe: body.rpe ?? null,
    note: body.note ?? null,
    location: null,
    distanceKm: null,
    avgPaceSecPerKm: null,
    avgHr: null,
    stravaId: null,
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
    rpe: body.rpe !== undefined ? body.rpe : existing.rpe,
    note: body.note !== undefined ? body.note : existing.note,
    durationMin: body.durationMin !== undefined ? body.durationMin : existing.durationMin,
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

async function alternatives(sessionId: string, sessionExerciseId: string): Promise<Exercise[]> {
  const session = await getSession(sessionId)
  if (!session) throw new Error('Session not found')
  const se = session.exercises.find((x) => x.id === sessionExerciseId)
  if (!se) throw new Error('Session exercise not found')
  return alternativesFor(session, se)
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

async function dashboard(): Promise<DashboardResponse> {
  const today = todayStr()
  const currentWs = weekStart(today)
  const settings = await getSettings()

  // 12 weeks of done sessions covers weekly volume + lift progression; go a bit
  // wider so streak math is stable.
  const doneSessions = await doneSessionsSince(addDays(currentWs, -7 * 60))

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
      const doneWeighted = se.sets.filter((s) => s.done && s.weightKg != null)
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

  const topLifts = [...perExercise.entries()]
    .sort((a, b) => b[1].sessionDates.size - a[1].sessionDates.size || a[1].name.localeCompare(b[1].name))
    .slice(0, 6)

  const liftProgression: DashboardResponse['liftProgression'] = topLifts.map(([exerciseId, entry]) => {
    const byDate = new Map<string, { w: number; reps: number }>()
    for (const p of entry.points) {
      const cur = byDate.get(p.date)
      if (!cur || p.w > cur.w || (p.w === cur.w && p.reps > cur.reps)) {
        byDate.set(p.date, { w: p.w, reps: p.reps })
      }
    }
    const points = [...byDate.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
      .map(([date, top]) => ({
        date,
        topSetKg: top.w,
        est1Rm: Math.round(top.w * (1 + top.reps / 30) * 10) / 10, // Epley
      }))
    return { exerciseId, name: entry.name, points }
  })

  const monthPrefix = today.slice(0, 7)
  const sessionsThisMonth = doneSessions.filter((s) => s.date.startsWith(monthPrefix)).length

  return {
    weeklyVolume,
    liftProgression,
    streakWeeks: computeStreakWeeks(doneSessions, settings.weeklyTarget),
    sessionsThisMonth,
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

  // Settings & anchors
  settings: () => getSettings(),
  updateSettings,
  addAnchor,
  deleteAnchor: (id: string) => deleteAnchorDoc(id),
}

// Re-exported so callers that generate ids locally (optimistic) stay consistent.
export { newId }
