// Cornerman — suggestion rule engine.
// POST /api/suggest {minutes, location} -> creates a planned Session for today.
import {
  db,
  getAllExercises,
  getSession,
  todayStr,
  addDays,
  type SessionRow,
} from './db.ts';
import type { Exercise, Session, SuggestRequest, WorkoutSplit } from '../shared/types.ts';
import { buildSlots, filterPool, pickExercises } from '../shared/planning.ts';

const STRENGTH_SPORTS = ['weightlifting', 'calisthenics'] as const;
const CYCLE: WorkoutSplit[] = ['push', 'pull', 'legs'];

export type YesterdayLoad = 'rest' | 'light' | 'moderate' | 'hard';

/** Recovery signal from yesterday's done sessions. */
export function computeYesterdayLoad(today: string = todayStr()): YesterdayLoad {
  const yesterday = addDays(today, -1);
  const rows = db
    .prepare("SELECT * FROM sessions WHERE date = ? AND status = 'done'")
    .all(yesterday) as SessionRow[];
  if (rows.length === 0) return 'rest';
  const maxRpe = Math.max(...rows.map((r) => r.rpe ?? 0));
  const hardCombat = rows.some(
    (r) => (r.sport === 'kickboxing' || r.sport === 'boxing') && (r.duration_min ?? 0) >= 60
  );
  if (maxRpe >= 8 || hardCombat) return 'hard';
  if (maxRpe >= 6) return 'moderate';
  return 'light';
}

/** Last N done strength sessions, most recent first. */
function recentStrengthSessions(limit: number): SessionRow[] {
  return db
    .prepare(
      `SELECT * FROM sessions
       WHERE sport IN (?, ?) AND status = 'done'
       ORDER BY date DESC, id DESC LIMIT ?`
    )
    .all(STRENGTH_SPORTS[0], STRENGTH_SPORTS[1], limit) as SessionRow[];
}

/** Dominant push/pull/legs split of a session's exercises. */
function dominantSplit(sessionId: number): WorkoutSplit | null {
  const rows = db
    .prepare(
      `SELECT e.category AS category, COUNT(*) AS n
       FROM session_exercises se JOIN exercises e ON e.id = se.exercise_id
       WHERE se.session_id = ? AND e.category IN ('push','pull','legs')
       GROUP BY e.category ORDER BY n DESC`
    )
    .all(sessionId) as { category: WorkoutSplit; n: number }[];
  return rows.length > 0 ? rows[0].category : null;
}

/** Next split in the push -> pull -> legs rotation based on the last done strength session. */
function nextSplit(): WorkoutSplit {
  const recent = recentStrengthSessions(5);
  for (const s of recent) {
    const cat = dominantSplit(s.id);
    if (cat) return CYCLE[(CYCLE.indexOf(cat) + 1) % CYCLE.length];
  }
  return 'push';
}

/** Exercise ids used in the last 2 done strength sessions (variety exclusion). */
function recentlyUsedExerciseIds(): Set<string> {
  const recent = recentStrengthSessions(2);
  const used = new Set<string>();
  const stmt = db.prepare('SELECT exercise_id FROM session_exercises WHERE session_id = ?');
  for (const s of recent) {
    const rows = stmt.all(s.id) as { exercise_id: string }[];
    for (const r of rows) used.add(r.exercise_id);
  }
  return used;
}

interface ProgressionResult {
  suggestedWeightKg: number | null;
  targetReps: [number, number];
}

/** Progression: based on last done sets of the same exercise. */
function progressionFor(ex: Exercise): ProgressionResult {
  const [baseLow, baseHigh] = ex.repRange;
  const lastSe = db
    .prepare(
      `SELECT se.id, se.target_rep_low, se.target_rep_high
       FROM session_exercises se
       JOIN sessions s ON s.id = se.session_id
       WHERE se.exercise_id = ? AND s.status = 'done'
         AND EXISTS (SELECT 1 FROM sets st WHERE st.session_exercise_id = se.id AND st.done = 1)
       ORDER BY s.date DESC, se.id DESC LIMIT 1`
    )
    .get(ex.id) as { id: number; target_rep_low: number; target_rep_high: number } | undefined;

  if (!lastSe) {
    return { suggestedWeightKg: null, targetReps: [baseLow, baseHigh] };
  }

  const doneSets = db
    .prepare('SELECT reps, weight_kg FROM sets WHERE session_exercise_id = ? AND done = 1')
    .all(lastSe.id) as { reps: number; weight_kg: number | null }[];

  if (ex.type === 'weighted') {
    const weights = doneSets.map((s) => s.weight_kg).filter((w): w is number => w !== null);
    if (weights.length === 0) {
      return { suggestedWeightKg: null, targetReps: [baseLow, baseHigh] };
    }
    const lastWeight = Math.max(...weights);
    const allTopped = doneSets.every((s) => s.reps >= baseHigh);
    return {
      suggestedWeightKg: allTopped ? lastWeight + 2.5 : lastWeight,
      targetReps: [baseLow, baseHigh],
    };
  }

  // Bodyweight (and timed): progress by shifting target reps up, capped at +4 over the base range.
  const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);
  let low = clamp(lastSe.target_rep_low, baseLow, baseLow + 4);
  let high = clamp(lastSe.target_rep_high, baseHigh, baseHigh + 4);
  const allTopped = doneSets.length > 0 && doneSets.every((s) => s.reps >= high);
  if (allTopped) {
    low = Math.min(low + 1, baseLow + 4);
    high = Math.min(high + 1, baseHigh + 4);
  }
  return { suggestedWeightKg: null, targetReps: [low, high] };
}

/** Generate + persist a planned strength session for today. Returns the full Session. */
export function suggestSession(req: SuggestRequest): Session {
  const { minutes, location } = req;
  const today = todayStr();
  const load = computeYesterdayLoad(today);
  const hard = load === 'hard';

  // 6. Replace any existing planned/in_progress session for today.
  db.prepare(
    "DELETE FROM sessions WHERE date = ? AND status IN ('planned', 'in_progress')"
  ).run(today);

  const split = req.split ?? nextSplit();
  const slots = buildSlots(minutes, split, req.focus);
  const used = recentlyUsedExerciseIds();
  const pool = filterPool(getAllExercises(), location, hard);
  const picked = pickExercises(slots, pool, hard, used);

  // 5. Sport of the generated session.
  const allBodyweight = picked.every((e) => e.type !== 'weighted');
  const sport = allBodyweight ? 'calisthenics' : 'weightlifting';

  const setsPerExercise = (e: Exercise): number => {
    if (minutes !== 60) return 3;
    return e.category === 'core' || e.category === 'conditioning' ? 3 : 4;
  };

  const insertSession = db.prepare(
    `INSERT INTO sessions (date, sport, source, status, duration_min, location)
     VALUES (?, ?, 'generated', 'planned', ?, ?)`
  );
  const insertSe = db.prepare(
    `INSERT INTO session_exercises
       (session_id, exercise_id, ord, target_sets, target_rep_low, target_rep_high, suggested_weight_kg)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const insertSet = db.prepare(
    `INSERT INTO sets (session_exercise_id, set_number, reps, weight_kg, seconds, done)
     VALUES (?, ?, ?, ?, ?, 0)`
  );

  const createAll = db.transaction((): number => {
    const sessionId = Number(insertSession.run(today, sport, minutes, location).lastInsertRowid);
    picked.forEach((e, i) => {
      const prog = progressionFor(e);
      const targetSets = setsPerExercise(e);
      const seId = Number(
        insertSe.run(
          sessionId,
          e.id,
          i + 1,
          targetSets,
          prog.targetReps[0],
          prog.targetReps[1],
          prog.suggestedWeightKg
        ).lastInsertRowid
      );
      for (let n = 1; n <= targetSets; n++) {
        insertSet.run(
          seId,
          n,
          e.type === 'timed' ? 0 : prog.targetReps[0],
          prog.suggestedWeightKg,
          e.type === 'timed' ? prog.targetReps[0] : null
        );
      }
    });
    return sessionId;
  });

  const sessionId = createAll();
  const session = getSession(sessionId);
  if (!session) throw new Error('Failed to create suggested session');
  return session;
}

/** Progression info for a single exercise added manually to a session. */
export function progressionForExercise(ex: Exercise): ProgressionResult {
  return progressionFor(ex);
}

/** Alternatives: same category, fits location, not already in the session. */
export function alternativesFor(sessionExerciseId: number): Exercise[] | null {
  const se = db
    .prepare('SELECT session_id, exercise_id FROM session_exercises WHERE id = ?')
    .get(sessionExerciseId) as { session_id: number; exercise_id: string } | undefined;
  if (!se) return null;
  const session = getSession(se.session_id);
  if (!session) return null;
  const current = getAllExercises().find((e) => e.id === se.exercise_id);
  if (!current) return null;
  const inSession = new Set(session.exercises.map((x) => x.exerciseId));
  const location = session.location;
  return getAllExercises().filter(
    (e) =>
      e.category === current.category &&
      !inSession.has(e.id) &&
      (location === null || location === 'gym' || e.location.includes(location))
  );
}
