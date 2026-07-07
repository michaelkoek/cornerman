// Cornerman — backend entry. Hono on @hono/node-server, port 4100.
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import {
  db,
  getSetting,
  setSetting,
  getSession,
  getSessionExercise,
  getAllExercises,
  getExercise,
  getAnchors,
  rowToSession,
  rowToSet,
  todayStr,
  addDays,
  weekStart,
  type SessionRow,
} from './db.ts';
import {
  suggestSession,
  computeYesterdayLoad,
  alternativesFor,
  progressionForExercise,
} from './engine.ts';
import { stravaRoutes, stravaConnected } from './strava.ts';
import type {
  Anchor,
  CreateSessionRequest,
  DashboardResponse,
  Session,
  SessionStatus,
  Settings,
  SetLog,
  Sport,
  SuggestRequest,
  TodayResponse,
} from '../shared/types.ts';

// Load .env if present (STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET)
try {
  process.loadEnvFile(join(dirname(fileURLToPath(import.meta.url)), '..', '.env'));
} catch {
  /* no .env file — fine */
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 4100;

const app = new Hono();

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err instanceof Error ? err.message : 'Internal server error' }, 500);
});

// ---------- helpers ----------

function getWeeklyTarget(): number {
  return Number(getSetting('weeklyTarget') ?? '4');
}

function doneCountForWeek(ws: string): number {
  const we = addDays(ws, 6);
  const row = db
    .prepare("SELECT COUNT(*) AS n FROM sessions WHERE status = 'done' AND date >= ? AND date <= ?")
    .get(ws, we) as { n: number };
  return row.n;
}

/** Consecutive weeks hitting the weekly target, counting current week if it already hit. */
function computeStreakWeeks(target: number): number {
  if (target <= 0) return 0;
  const currentWs = weekStart(todayStr());
  let ws = doneCountForWeek(currentWs) >= target ? currentWs : addDays(currentWs, -7);
  let streak = 0;
  while (streak < 520 && doneCountForWeek(ws) >= target) {
    streak++;
    ws = addDays(ws, -7);
  }
  return streak;
}

function buildSettings(): Settings {
  return {
    weeklyTarget: getWeeklyTarget(),
    anchors: getAnchors(),
    stravaConnected: stravaConnected(),
  };
}

const SPORTS: Sport[] = ['kickboxing', 'boxing', 'running', 'calisthenics', 'weightlifting', 'conditioning'];
const STATUSES: SessionStatus[] = ['planned', 'in_progress', 'done', 'skipped'];

// ---------- today ----------

app.get('/api/today', (c) => {
  const date = todayStr();
  const target = getWeeklyTarget();

  const weekday = new Date().getDay(); // 0=Sunday..6=Saturday
  const anchor = getAnchors().find((a) => a.weekday === weekday) ?? null;

  const sessionRow = db
    .prepare(
      `SELECT * FROM sessions WHERE date = ? AND status IN ('in_progress', 'planned', 'done')
       ORDER BY CASE status WHEN 'in_progress' THEN 0 WHEN 'planned' THEN 1 ELSE 2 END, id DESC
       LIMIT 1`
    )
    .get(date) as SessionRow | undefined;

  const ws = weekStart(date);
  const weekSessions = doneCountForWeek(ws);

  const res: TodayResponse = {
    date,
    anchor,
    session: sessionRow ? rowToSession(sessionRow) : null,
    yesterdayLoad: computeYesterdayLoad(date),
    weekSessions,
    weeklyTarget: target,
    streakWeeks: computeStreakWeeks(target),
  };
  return c.json(res);
});

// ---------- suggest ----------

app.post('/api/suggest', async (c) => {
  const body = (await c.req.json().catch(() => null)) as Partial<SuggestRequest> | null;
  if (!body || ![20, 45, 60].includes(body.minutes as number) || !['home', 'gym'].includes(body.location as string)) {
    return c.json({ error: 'Expected body { minutes: 20|45|60, location: "home"|"gym" }' }, 400);
  }
  const session = suggestSession({ minutes: body.minutes as 20 | 45 | 60, location: body.location as 'home' | 'gym' });
  return c.json(session, 201);
});

// ---------- sessions CRUD ----------

app.get('/api/sessions', (c) => {
  const from = c.req.query('from');
  const to = c.req.query('to');
  const clauses: string[] = [];
  const params: string[] = [];
  if (from) {
    clauses.push('date >= ?');
    params.push(from);
  }
  if (to) {
    clauses.push('date <= ?');
    params.push(to);
  }
  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db
    .prepare(`SELECT * FROM sessions ${where} ORDER BY date DESC, id DESC`)
    .all(...params) as SessionRow[];
  const sessions: Session[] = rows.map(rowToSession);
  return c.json(sessions);
});

app.get('/api/sessions/:id', (c) => {
  const session = getSession(Number(c.req.param('id')));
  if (!session) return c.json({ error: 'Session not found' }, 404);
  return c.json(session);
});

app.post('/api/sessions', async (c) => {
  const body = (await c.req.json().catch(() => null)) as Partial<CreateSessionRequest> | null;
  if (!body || typeof body.date !== 'string' || !SPORTS.includes(body.sport as Sport)) {
    return c.json({ error: 'Expected body { date, sport, durationMin?, rpe?, note?, status? }' }, 400);
  }
  const status: SessionStatus = STATUSES.includes(body.status as SessionStatus)
    ? (body.status as SessionStatus)
    : 'done';
  const info = db
    .prepare(
      `INSERT INTO sessions (date, sport, source, status, duration_min, rpe, note)
       VALUES (?, ?, 'manual', ?, ?, ?, ?)`
    )
    .run(
      body.date,
      body.sport,
      status,
      body.durationMin ?? null,
      body.rpe ?? null,
      body.note ?? null
    );
  const session = getSession(Number(info.lastInsertRowid));
  return c.json(session, 201);
});

app.patch('/api/sessions/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const existing = getSession(id);
  if (!existing) return c.json({ error: 'Session not found' }, 404);
  const body = (await c.req.json().catch(() => null)) as {
    status?: SessionStatus;
    rpe?: number | null;
    note?: string | null;
    durationMin?: number | null;
    location?: 'home' | 'gym' | null;
    date?: string;
  } | null;
  if (!body) return c.json({ error: 'Invalid JSON body' }, 400);
  if (body.status !== undefined && !STATUSES.includes(body.status)) {
    return c.json({ error: `status must be one of ${STATUSES.join(', ')}` }, 400);
  }
  db.prepare(
    `UPDATE sessions SET
       status = COALESCE(?, status),
       rpe = CASE WHEN ? THEN rpe ELSE ? END,
       note = CASE WHEN ? THEN note ELSE ? END,
       duration_min = CASE WHEN ? THEN duration_min ELSE ? END,
       location = CASE WHEN ? THEN location ELSE ? END,
       date = COALESCE(?, date)
     WHERE id = ?`
  ).run(
    body.status ?? null,
    body.rpe === undefined ? 1 : 0,
    body.rpe ?? null,
    body.note === undefined ? 1 : 0,
    body.note ?? null,
    body.durationMin === undefined ? 1 : 0,
    body.durationMin ?? null,
    body.location === undefined ? 1 : 0,
    body.location ?? null,
    body.date ?? null,
    id
  );
  return c.json(getSession(id));
});

app.delete('/api/sessions/:id', (c) => {
  const id = Number(c.req.param('id'));
  const info = db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
  if (info.changes === 0) return c.json({ error: 'Session not found' }, 404);
  return c.json({ ok: true });
});

// ---------- sets ----------

app.patch('/api/sets/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const existing = db.prepare('SELECT id FROM sets WHERE id = ?').get(id);
  if (!existing) return c.json({ error: 'Set not found' }, 404);
  const body = (await c.req.json().catch(() => null)) as {
    reps?: number;
    weightKg?: number | null;
    seconds?: number | null;
    done?: boolean;
  } | null;
  if (!body) return c.json({ error: 'Invalid JSON body' }, 400);
  db.prepare(
    `UPDATE sets SET
       reps = COALESCE(?, reps),
       weight_kg = CASE WHEN ? THEN weight_kg ELSE ? END,
       seconds = CASE WHEN ? THEN seconds ELSE ? END,
       done = COALESCE(?, done)
     WHERE id = ?`
  ).run(
    body.reps ?? null,
    body.weightKg === undefined ? 1 : 0,
    body.weightKg ?? null,
    body.seconds === undefined ? 1 : 0,
    body.seconds ?? null,
    body.done === undefined ? null : body.done ? 1 : 0,
    id
  );
  const row = db.prepare('SELECT * FROM sets WHERE id = ?').get(id) as {
    id: number;
    session_exercise_id: number;
    set_number: number;
    reps: number;
    weight_kg: number | null;
    seconds: number | null;
    done: number;
  };
  const set: SetLog = rowToSet(row);
  return c.json(set);
});

// ---------- session exercises (add / remove / alternatives) ----------

app.post('/api/sessions/:id/exercises', async (c) => {
  const sessionId = Number(c.req.param('id'));
  const session = getSession(sessionId);
  if (!session) return c.json({ error: 'Session not found' }, 404);
  const body = (await c.req.json().catch(() => null)) as { exerciseId?: string } | null;
  const exercise = body?.exerciseId ? getExercise(body.exerciseId) : null;
  if (!exercise) return c.json({ error: 'Unknown exerciseId' }, 400);

  const prog = progressionForExercise(exercise);
  const ord = session.exercises.reduce((max, e) => Math.max(max, e.order), 0) + 1;
  const targetSets = 3;
  const seId = Number(
    db
      .prepare(
        `INSERT INTO session_exercises
           (session_id, exercise_id, ord, target_sets, target_rep_low, target_rep_high, suggested_weight_kg)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(sessionId, exercise.id, ord, targetSets, prog.targetReps[0], prog.targetReps[1], prog.suggestedWeightKg)
      .lastInsertRowid
  );
  const insertSet = db.prepare(
    'INSERT INTO sets (session_exercise_id, set_number, reps, weight_kg, seconds, done) VALUES (?, ?, ?, ?, ?, 0)'
  );
  for (let n = 1; n <= targetSets; n++) {
    insertSet.run(
      seId,
      n,
      exercise.type === 'timed' ? 0 : prog.targetReps[0],
      prog.suggestedWeightKg,
      exercise.type === 'timed' ? prog.targetReps[0] : null
    );
  }
  return c.json(getSessionExercise(seId), 201);
});

app.delete('/api/session-exercises/:id', (c) => {
  const id = Number(c.req.param('id'));
  const info = db.prepare('DELETE FROM session_exercises WHERE id = ?').run(id);
  if (info.changes === 0) return c.json({ error: 'Session exercise not found' }, 404);
  return c.json({ ok: true });
});

app.get('/api/session-exercises/:id/alternatives', (c) => {
  const alts = alternativesFor(Number(c.req.param('id')));
  if (alts === null) return c.json({ error: 'Session exercise not found' }, 404);
  return c.json(alts);
});

// ---------- dashboard ----------

app.get('/api/dashboard', (c) => {
  const today = todayStr();
  const currentWs = weekStart(today);

  // Weekly volume: minutes per sport, last 12 weeks (oldest first).
  const volumeStmt = db.prepare(
    `SELECT sport, SUM(COALESCE(duration_min, 0)) AS minutes
     FROM sessions WHERE status = 'done' AND date >= ? AND date <= ?
     GROUP BY sport`
  );
  const weeklyVolume: DashboardResponse['weeklyVolume'] = [];
  for (let i = 11; i >= 0; i--) {
    const ws = addDays(currentWs, -7 * i);
    const rows = volumeStmt.all(ws, addDays(ws, 6)) as { sport: Sport; minutes: number }[];
    const bySport: Partial<Record<Sport, number>> = {};
    for (const r of rows) bySport[r.sport] = r.minutes;
    weeklyVolume.push({ weekStart: ws, bySport });
  }

  // Lift progression: top 6 most-logged weighted exercises.
  const topLifts = db
    .prepare(
      `SELECT se.exercise_id AS exerciseId, e.name AS name, COUNT(DISTINCT s.id) AS n
       FROM session_exercises se
       JOIN sessions s ON s.id = se.session_id AND s.status = 'done'
       JOIN exercises e ON e.id = se.exercise_id AND e.type = 'weighted'
       JOIN sets st ON st.session_exercise_id = se.id AND st.done = 1 AND st.weight_kg IS NOT NULL
       GROUP BY se.exercise_id ORDER BY n DESC, e.name LIMIT 6`
    )
    .all() as { exerciseId: string; name: string; n: number }[];

  const pointsStmt = db.prepare(
    `SELECT s.date AS date, st.weight_kg AS w, st.reps AS reps
     FROM sets st
     JOIN session_exercises se ON se.id = st.session_exercise_id
     JOIN sessions s ON s.id = se.session_id
     WHERE se.exercise_id = ? AND s.status = 'done' AND st.done = 1 AND st.weight_kg IS NOT NULL
     ORDER BY s.date`
  );

  const liftProgression: DashboardResponse['liftProgression'] = topLifts.map((lift) => {
    const rows = pointsStmt.all(lift.exerciseId) as { date: string; w: number; reps: number }[];
    const byDate = new Map<string, { w: number; reps: number }>();
    for (const r of rows) {
      const cur = byDate.get(r.date);
      if (!cur || r.w > cur.w || (r.w === cur.w && r.reps > cur.reps)) {
        byDate.set(r.date, { w: r.w, reps: r.reps });
      }
    }
    const points = [...byDate.entries()].map(([date, top]) => ({
      date,
      topSetKg: top.w,
      est1Rm: Math.round(top.w * (1 + top.reps / 30) * 10) / 10, // Epley
    }));
    return { exerciseId: lift.exerciseId, name: lift.name, points };
  });

  const monthPrefix = today.slice(0, 7); // YYYY-MM
  const monthRow = db
    .prepare("SELECT COUNT(*) AS n FROM sessions WHERE status = 'done' AND date LIKE ?")
    .get(`${monthPrefix}-%`) as { n: number };

  const res: DashboardResponse = {
    weeklyVolume,
    liftProgression,
    streakWeeks: computeStreakWeeks(getWeeklyTarget()),
    sessionsThisMonth: monthRow.n,
  };
  return c.json(res);
});

// ---------- settings & anchors ----------

app.get('/api/settings', (c) => c.json(buildSettings()));

app.put('/api/settings', async (c) => {
  const body = (await c.req.json().catch(() => null)) as { weeklyTarget?: number } | null;
  if (!body || typeof body.weeklyTarget !== 'number' || body.weeklyTarget < 1 || body.weeklyTarget > 14) {
    return c.json({ error: 'Expected body { weeklyTarget: number (1-14) }' }, 400);
  }
  setSetting('weeklyTarget', String(Math.round(body.weeklyTarget)));
  return c.json(buildSettings());
});

app.post('/api/anchors', async (c) => {
  const body = (await c.req.json().catch(() => null)) as Partial<Omit<Anchor, 'id'>> | null;
  if (
    !body ||
    typeof body.weekday !== 'number' ||
    body.weekday < 0 ||
    body.weekday > 6 ||
    !SPORTS.includes(body.sport as Sport) ||
    typeof body.time !== 'string' ||
    typeof body.label !== 'string'
  ) {
    return c.json({ error: 'Expected body { weekday: 0-6, sport, time, label }' }, 400);
  }
  const info = db
    .prepare('INSERT INTO anchors (weekday, sport, time, label) VALUES (?, ?, ?, ?)')
    .run(body.weekday, body.sport, body.time, body.label);
  const anchor: Anchor = {
    id: Number(info.lastInsertRowid),
    weekday: body.weekday,
    sport: body.sport as Sport,
    time: body.time,
    label: body.label,
  };
  return c.json(anchor, 201);
});

app.delete('/api/anchors/:id', (c) => {
  const info = db.prepare('DELETE FROM anchors WHERE id = ?').run(Number(c.req.param('id')));
  if (info.changes === 0) return c.json({ error: 'Anchor not found' }, 404);
  return c.json({ ok: true });
});

// ---------- exercises ----------

app.get('/api/exercises', (c) => {
  const location = c.req.query('location');
  const category = c.req.query('category');
  let list = getAllExercises();
  if (location === 'home') list = list.filter((e) => e.location.includes('home'));
  if (category) list = list.filter((e) => e.category === category);
  return c.json(list);
});

// ---------- strava ----------

app.route('/api/strava', stravaRoutes);

// ---------- static frontend (production) ----------

const distPath = join(__dirname, '..', 'dist');
if (existsSync(distPath)) {
  const root = relative(process.cwd(), distPath) || '.';
  app.use('*', serveStatic({ root }));
  const indexHtml = readFileSync(join(distPath, 'index.html'), 'utf-8');
  app.get('*', (c) => {
    if (c.req.path.startsWith('/api/')) return c.json({ error: 'Not found' }, 404);
    return c.html(indexHtml);
  });
}

app.notFound((c) => c.json({ error: 'Not found' }, 404));

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`Cornerman backend listening on http://localhost:${info.port}`);
});
