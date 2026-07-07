// Cornerman — database layer. Schema init, seeding, row mapping, date helpers.
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type {
  Anchor,
  Exercise,
  Session,
  SessionExercise,
  SessionSource,
  SessionStatus,
  SetLog,
  Sport,
  ExerciseCategory,
  Equipment,
  Location,
} from '../shared/types.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = join(__dirname, '..', 'data');
const DB_PATH = join(DATA_DIR, 'cornerman.db');

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ---------- schema ----------

db.exec(`
CREATE TABLE IF NOT EXISTS exercises (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  muscle_groups TEXT NOT NULL,   -- JSON array
  equipment TEXT NOT NULL,       -- JSON array
  location TEXT NOT NULL,        -- JSON array
  difficulty INTEGER NOT NULL,
  type TEXT NOT NULL,
  rep_low INTEGER NOT NULL,
  rep_high INTEGER NOT NULL,
  cue TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  sport TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'done',
  duration_min INTEGER,
  rpe INTEGER,
  note TEXT,
  location TEXT,
  distance_km REAL,
  avg_pace_sec_per_km REAL,
  avg_hr REAL,
  strava_id TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS session_exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL REFERENCES exercises(id),
  ord INTEGER NOT NULL,
  target_sets INTEGER NOT NULL,
  target_rep_low INTEGER NOT NULL,
  target_rep_high INTEGER NOT NULL,
  suggested_weight_kg REAL
);

CREATE TABLE IF NOT EXISTS sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_exercise_id INTEGER NOT NULL REFERENCES session_exercises(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL,
  reps INTEGER NOT NULL DEFAULT 0,
  weight_kg REAL,
  seconds INTEGER,
  done INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS anchors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  weekday INTEGER NOT NULL,
  sport TEXT NOT NULL,
  time TEXT NOT NULL,
  label TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date);
CREATE INDEX IF NOT EXISTS idx_se_session ON session_exercises(session_id);
CREATE INDEX IF NOT EXISTS idx_se_exercise ON session_exercises(exercise_id);
CREATE INDEX IF NOT EXISTS idx_sets_se ON sets(session_exercise_id);
`);

// ---------- settings helpers ----------

export function getSetting(key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return row ? row.value : null;
}

export function setSetting(key: string, value: string): void {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, value);
}

export function deleteSetting(key: string): void {
  db.prepare('DELETE FROM settings WHERE key = ?').run(key);
}

// ---------- seed ----------

function seed(): void {
  const raw = readFileSync(join(DATA_DIR, 'exercises.json'), 'utf-8');
  const list = JSON.parse(raw) as Exercise[];
  const upsert = db.prepare(`
    INSERT INTO exercises (id, name, category, muscle_groups, equipment, location, difficulty, type, rep_low, rep_high, cue)
    VALUES (@id, @name, @category, @muscleGroups, @equipment, @location, @difficulty, @type, @repLow, @repHigh, @cue)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name, category = excluded.category, muscle_groups = excluded.muscle_groups,
      equipment = excluded.equipment, location = excluded.location, difficulty = excluded.difficulty,
      type = excluded.type, rep_low = excluded.rep_low, rep_high = excluded.rep_high, cue = excluded.cue
  `);
  const tx = db.transaction((items: Exercise[]) => {
    for (const e of items) {
      upsert.run({
        id: e.id,
        name: e.name,
        category: e.category,
        muscleGroups: JSON.stringify(e.muscleGroups),
        equipment: JSON.stringify(e.equipment),
        location: JSON.stringify(e.location),
        difficulty: e.difficulty,
        type: e.type,
        repLow: e.repRange[0],
        repHigh: e.repRange[1],
        cue: e.cue,
      });
    }
  });
  tx(list);

  // First-boot defaults
  if (getSetting('weeklyTarget') === null) {
    setSetting('weeklyTarget', '4');
  }
  if (getSetting('anchorsSeeded') === null) {
    const ins = db.prepare('INSERT INTO anchors (weekday, sport, time, label) VALUES (?, ?, ?, ?)');
    ins.run(2, 'kickboxing', '19:00', 'Kickboxing class'); // Tuesday
    ins.run(4, 'kickboxing', '19:00', 'Kickboxing class'); // Thursday
    setSetting('anchorsSeeded', '1');
  }
}
seed();

// ---------- date helpers (local time, Monday-based weeks) ----------

export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayStr(): string {
  return toDateStr(new Date());
}

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
  const dt = new Date(y, m - 1, d + days);
  return toDateStr(dt);
}

/** Monday of the week containing dateStr. */
export function weekStart(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
  const dt = new Date(y, m - 1, d);
  const dow = dt.getDay(); // 0=Sun..6=Sat
  const diff = dow === 0 ? -6 : 1 - dow;
  return addDays(dateStr, diff);
}

// ---------- row types & mapping ----------

interface ExerciseRow {
  id: string;
  name: string;
  category: string;
  muscle_groups: string;
  equipment: string;
  location: string;
  difficulty: number;
  type: string;
  rep_low: number;
  rep_high: number;
  cue: string;
}

export interface SessionRow {
  id: number;
  date: string;
  sport: string;
  source: string;
  status: string;
  duration_min: number | null;
  rpe: number | null;
  note: string | null;
  location: string | null;
  distance_km: number | null;
  avg_pace_sec_per_km: number | null;
  avg_hr: number | null;
  strava_id: string | null;
}

interface SessionExerciseRow {
  id: number;
  session_id: number;
  exercise_id: string;
  ord: number;
  target_sets: number;
  target_rep_low: number;
  target_rep_high: number;
  suggested_weight_kg: number | null;
}

interface SetRow {
  id: number;
  session_exercise_id: number;
  set_number: number;
  reps: number;
  weight_kg: number | null;
  seconds: number | null;
  done: number;
}

export function rowToExercise(r: ExerciseRow): Exercise {
  return {
    id: r.id,
    name: r.name,
    category: r.category as ExerciseCategory,
    muscleGroups: JSON.parse(r.muscle_groups) as string[],
    equipment: JSON.parse(r.equipment) as Equipment[],
    location: JSON.parse(r.location) as Location[],
    difficulty: r.difficulty as 1 | 2 | 3,
    type: r.type as Exercise['type'],
    repRange: [r.rep_low, r.rep_high],
    cue: r.cue,
  };
}

export function rowToSet(r: SetRow): SetLog {
  return {
    id: r.id,
    setNumber: r.set_number,
    reps: r.reps,
    weightKg: r.weight_kg,
    seconds: r.seconds,
    done: r.done === 1,
  };
}

export function getExercise(id: string): Exercise | null {
  const row = db.prepare('SELECT * FROM exercises WHERE id = ?').get(id) as ExerciseRow | undefined;
  return row ? rowToExercise(row) : null;
}

export function getAllExercises(): Exercise[] {
  const rows = db.prepare('SELECT * FROM exercises ORDER BY name').all() as ExerciseRow[];
  return rows.map(rowToExercise);
}

export function getSessionExercise(seId: number): SessionExercise | null {
  const row = db
    .prepare('SELECT * FROM session_exercises WHERE id = ?')
    .get(seId) as SessionExerciseRow | undefined;
  if (!row) return null;
  return rowToSessionExercise(row);
}

function rowToSessionExercise(row: SessionExerciseRow): SessionExercise {
  const exercise = getExercise(row.exercise_id);
  if (!exercise) throw new Error(`Exercise not found: ${row.exercise_id}`);
  const setRows = db
    .prepare('SELECT * FROM sets WHERE session_exercise_id = ? ORDER BY set_number')
    .all(row.id) as SetRow[];
  return {
    id: row.id,
    exerciseId: row.exercise_id,
    exercise,
    order: row.ord,
    targetSets: row.target_sets,
    targetReps: [row.target_rep_low, row.target_rep_high],
    suggestedWeightKg: row.suggested_weight_kg,
    sets: setRows.map(rowToSet),
  };
}

export function rowToSession(row: SessionRow): Session {
  const seRows = db
    .prepare('SELECT * FROM session_exercises WHERE session_id = ? ORDER BY ord')
    .all(row.id) as SessionExerciseRow[];
  return {
    id: row.id,
    date: row.date,
    sport: row.sport as Sport,
    source: row.source as SessionSource,
    status: row.status as SessionStatus,
    durationMin: row.duration_min,
    rpe: row.rpe,
    note: row.note,
    location: row.location as Location | null,
    distanceKm: row.distance_km,
    avgPaceSecPerKm: row.avg_pace_sec_per_km,
    avgHr: row.avg_hr,
    stravaId: row.strava_id,
    exercises: seRows.map(rowToSessionExercise),
  };
}

export function getSession(id: number): Session | null {
  const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as SessionRow | undefined;
  return row ? rowToSession(row) : null;
}

export function getAnchors(): Anchor[] {
  const rows = db
    .prepare('SELECT id, weekday, sport, time, label FROM anchors ORDER BY weekday, time')
    .all() as { id: number; weekday: number; sport: string; time: string; label: string }[];
  return rows.map((r) => ({
    id: r.id,
    weekday: r.weekday,
    sport: r.sport as Sport,
    time: r.time,
    label: r.label,
  }));
}
