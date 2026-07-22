// Cornerman shared API contract. Backend (server/) and frontend (src/) both import from here.

export type Sport =
  | 'kickboxing'
  | 'boxing'
  | 'running'
  | 'calisthenics'
  | 'weightlifting'
  | 'conditioning';

export type ExerciseCategory = 'push' | 'pull' | 'legs' | 'core' | 'conditioning';
export type WorkoutSplit = Extract<ExerciseCategory, 'push' | 'pull' | 'legs'>;
export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'kettlebell'
  | 'machine'
  | 'cable'
  | 'bodyweight'
  | 'pullup-bar'
  | 'bench'
  | 'none';
export type Location = 'home' | 'gym';

export interface Exercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  muscleGroups: string[];
  equipment: Equipment[];
  location: Location[];
  difficulty: 1 | 2 | 3;
  type: 'weighted' | 'bodyweight' | 'timed';
  repRange: [number, number];
  cue: string;
  // Links to LibraryExercise.id (hasaneyldrm/exercises-dataset) for GIF + instructions.
  datasetId?: string;
}

// One entry of the bundled exercise library (data/exercise-library.json),
// generated from hasaneyldrm/exercises-dataset by scripts/prepare-exercise-library.ts.
// Vocabulary is the raw dataset's, not the app's (equipment is a free string like
// "leverage machine" — mapping to the Equipment union happens only at curation time).
export interface LibraryExercise {
  id: string; // dataset id, e.g. "0001"
  name: string;
  bodyPart: string; // e.g. "waist", "chest", "upper arms"
  target: string; // primary muscle, e.g. "abs"
  secondaryMuscles: string[];
  equipment: string;
  media: string; // filename stem for images/{media}.jpg and videos/{media}.gif
  steps: string[]; // English instruction steps
}

export interface SetLog {
  id: string;
  setNumber: number;
  reps: number;
  weightKg: number | null; // null for bodyweight/timed
  seconds: number | null; // for timed exercises
  done: boolean;
}

export interface SessionExercise {
  id: string;
  exerciseId: string;
  exercise: Exercise;
  order: number;
  // suggestion produced by the engine
  targetSets: number;
  targetReps: [number, number];
  suggestedWeightKg: number | null;
  sets: SetLog[];
}

export type SessionStatus = 'planned' | 'in_progress' | 'done' | 'skipped';
export type SessionSource = 'manual' | 'generated' | 'strava' | 'anchor';

// One per-kilometre split of a Strava run (last split is usually shorter than 1 km).
export interface IRunSplit {
  km: number; // 1-based split index
  distanceM: number; // actual metres covered in this split
  paceSecPerKm: number | null;
  elevDiffM: number | null;
  avgHr: number | null;
}

// Rich run stats fetched from Strava's per-activity detail endpoint.
// Pauses are derived: elapsedTimeSec - movingTimeSec.
export interface IRunDetail {
  movingTimeSec: number;
  elapsedTimeSec: number;
  maxHr: number | null;
  avgCadence: number | null; // steps/min (Strava reports per-leg; doubled at ingest)
  elevationGainM: number | null;
  calories: number | null;
  splits: IRunSplit[];
}

export interface Session {
  id: string;
  date: string; // YYYY-MM-DD
  sport: Sport;
  source: SessionSource;
  status: SessionStatus;
  durationMin: number | null;
  // Wall-clock elapsed workout timer. startedAt = epoch ms when the current
  // running segment began (null while paused or never started). elapsedSec =
  // accumulated seconds of completed segments. Live elapsed is
  // elapsedSec + (startedAt ? (now - startedAt) / 1000 : 0). A session is
  // "paused" when status is in_progress, startedAt is null and elapsedSec > 0.
  startedAt: number | null;
  elapsedSec: number;
  rpe: number | null; // 1-10
  note: string | null;
  location: Location | null;
  // True when the session was built with the machines & cables filter; the
  // swap sheet keeps offering machine/cable alternatives for those exercises.
  machinesOnly: boolean;
  // running (strava) extras
  distanceKm: number | null;
  avgPaceSecPerKm: number | null;
  avgHr: number | null;
  stravaId: string | null;
  run: IRunDetail | null; // only set on strava-sourced running sessions
  exercises: SessionExercise[]; // empty for non-strength sessions
}

export interface Anchor {
  id: string;
  weekday: number; // 0=Sunday .. 6=Saturday
  sport: Sport;
  time: string; // "19:00"
  label: string; // "Kickboxing class"
}

export interface Settings {
  weeklyTarget: number; // sessions per week
  anchors: Anchor[];
  stravaConnected: boolean;
  stravaLastSyncAt: string | null; // ISO timestamp of the last successful sync
}

// --- API shapes ---

// Personal records for one exercise, derived from all-time done sessions.
// Which fields are non-null depends on Exercise.type:
// weighted -> maxWeightKg/maxWeightReps/bestEst1Rm, bodyweight -> maxReps, timed -> maxSeconds.
export interface ExercisePR {
  exerciseId: string;
  maxWeightKg: number | null; // heaviest done set (weighted only)
  maxWeightReps: number | null; // best reps at that max weight
  maxReps: number | null; // most reps in a single done set
  bestEst1Rm: number | null; // Epley over all done weighted sets
  maxSeconds: number | null; // longest done set (timed only)
  lastWeightKg: number | null; // weight of the most recent done set (recall)
  totalDoneSets: number;
  lastDate: string | null; // date of the most recent done set
}

// GET /api/today
export interface TodayResponse {
  date: string;
  anchor: Anchor | null; // today's anchor if any
  session: Session | null; // today's planned/in-progress/done session if any
  yesterdayLoad: 'rest' | 'light' | 'moderate' | 'hard'; // recovery signal
  weekSessions: number; // done sessions this week (Mon-Sun)
  weeklyTarget: number;
  streakWeeks: number; // consecutive weeks hitting target
  prBaselines?: Record<string, ExercisePR>; // by exerciseId — PR detection while logging
}

// Muscle-focus targets for the "Target a muscle" planner. Each maps to a
// muscle filter and/or category inside the engine (FOCUS_PRESETS).
export type FocusTarget =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'arms'
  | 'legs'
  | 'core'
  | 'stamina';

// POST /api/suggest { minutes: 20|45|60, location: Location, split?: WorkoutSplit }
// -> creates a planned strength session for today and returns it.
// split is optional — when omitted the engine picks the next one in the
// push -> pull -> legs rotation. focus overrides split when both are set.
export interface SuggestRequest {
  minutes: 20 | 45 | 60;
  location: Location;
  split?: WorkoutSplit;
  focus?: FocusTarget;
  // Gym only: restrict the pool to machine/cable exercises. Slots that can't
  // be filled that way fall back to the full gym pool.
  machinesOnly?: boolean;
}
// Response: Session

// POST /api/sessions  (manual log: kickboxing class, run without strava, etc.)
export interface CreateSessionRequest {
  date: string;
  sport: Sport;
  durationMin?: number;
  rpe?: number;
  note?: string;
  status?: SessionStatus; // default 'done'
}
// Response: Session

// PATCH /api/sessions/:id  — update status/rpe/note/duration
// PATCH /api/sets/:id — { reps?, weightKg?, seconds?, done? }
// POST /api/sessions/:id/exercises { exerciseId } — add exercise to session
// DELETE /api/session-exercises/:id — remove exercise (swap flow)
// GET /api/session-exercises/:id/alternatives — swap candidates (any category, fits location, not in session)

// GET /api/dashboard
export interface DashboardResponse {
  weeklyVolume: { weekStart: string; bySport: Partial<Record<Sport, number>> }[]; // minutes per sport, last 12 weeks
  liftProgression: {
    exerciseId: string;
    name: string;
    points: { date: string; topSetKg: number; est1Rm: number }[];
    pr?: ExercisePR;
  }[]; // top 6 most-logged weighted exercises
  streakWeeks: number;
  sessionsThisMonth: number;
  allLifts?: {
    exerciseId: string;
    name: string;
    sessions: number;
    maxWeightKg: number | null;
    bestEst1Rm: number | null;
    lastDate: string;
  }[]; // every weighted exercise ever logged, most-logged first
}

// GET /api/exercise-history/:exerciseId — per-exercise detail (Progress drill-in)
export interface ExerciseHistoryResponse {
  exercise: Exercise;
  pr: ExercisePR;
  points: { date: string; topSetKg: number; est1Rm: number; reps: number }[]; // all-time, top set per date, oldest first
  recent: {
    date: string;
    sets: { reps: number; weightKg: number | null; seconds: number | null }[];
  }[]; // last 5 sessions, newest first
}

// Bodyweight tracking
export interface BodyweightEntry {
  id: string;
  date: string; // YYYY-MM-DD — one entry per day, re-logging overwrites
  weightKg: number;
}

export interface BodyweightResponse {
  entries: BodyweightEntry[]; // oldest first
  currentKg: number | null; // most recent entry
  avg7dKg: number | null; // mean of entries in the last 7 days
  delta30dKg: number | null; // current vs ~30 days ago (or earliest entry)
  minKg: number | null; // all-time
  maxKg: number | null; // all-time
}

// GET /api/settings -> Settings
// PUT /api/settings { weeklyTarget }
// POST /api/anchors { weekday, sport, time, label } / DELETE /api/anchors/:id

// GET /api/exercises?location=&category= -> Exercise[]

// Strava — synced by scripts/strava/sync.ts (GitHub Actions cron), which writes
// sessions docs (source "strava", status "done", dedupe by stravaId) and the
// nested `run` detail. One-time auth: scripts/strava/authorize.ts.
