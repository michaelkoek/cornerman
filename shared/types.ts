// Cornerman shared API contract. Backend (server/) and frontend (src/) both import from here.

export type Sport =
  | 'kickboxing'
  | 'boxing'
  | 'running'
  | 'calisthenics'
  | 'weightlifting'
  | 'conditioning';

export type ExerciseCategory = 'push' | 'pull' | 'legs' | 'core' | 'conditioning';
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

export interface Session {
  id: string;
  date: string; // YYYY-MM-DD
  sport: Sport;
  source: SessionSource;
  status: SessionStatus;
  durationMin: number | null;
  rpe: number | null; // 1-10
  note: string | null;
  location: Location | null;
  // running (strava) extras
  distanceKm: number | null;
  avgPaceSecPerKm: number | null;
  avgHr: number | null;
  stravaId: string | null;
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

// POST /api/suggest { minutes: 20|45|60, location: Location }
// -> creates a planned strength session for today and returns it
export interface SuggestRequest {
  minutes: 20 | 45 | 60;
  location: Location;
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
// GET /api/session-exercises/:id/alternatives — list of Exercise fitting same slot

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

// Strava
// GET /api/strava/auth-url -> { url } (needs STRAVA_CLIENT_ID/SECRET in .env)
// GET /api/strava/callback?code= -> redirects to /settings
// POST /api/strava/sync -> { imported: number } (pulls runs, dedupes by stravaId)
