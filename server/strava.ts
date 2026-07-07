// Cornerman — Strava OAuth + run sync.
import { Hono } from 'hono';
import { db, getSetting, setSetting } from './db.ts';

const REDIRECT_URI = 'http://localhost:4100/api/strava/callback';

const K_ACCESS = 'strava_access_token';
const K_REFRESH = 'strava_refresh_token';
const K_EXPIRES = 'strava_expires_at'; // epoch seconds
const K_LAST_SYNC = 'strava_last_activity_epoch'; // epoch seconds of newest imported activity

export function stravaConnected(): boolean {
  return getSetting(K_ACCESS) !== null;
}

function envCreds(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

function storeTokens(t: TokenResponse): void {
  setSetting(K_ACCESS, t.access_token);
  setSetting(K_REFRESH, t.refresh_token);
  setSetting(K_EXPIRES, String(t.expires_at));
}

async function exchangeToken(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Strava token exchange failed (${res.status}): ${body}`);
  }
  return (await res.json()) as TokenResponse;
}

/** Returns a valid access token, refreshing if expired. Throws if not connected. */
async function accessToken(): Promise<string> {
  const token = getSetting(K_ACCESS);
  const refresh = getSetting(K_REFRESH);
  const expiresAt = Number(getSetting(K_EXPIRES) ?? '0');
  if (!token || !refresh) {
    throw new Error('Strava is not connected. Connect it from Settings first.');
  }
  const now = Math.floor(Date.now() / 1000);
  if (expiresAt - 60 > now) return token;

  const creds = envCreds();
  if (!creds) {
    throw new Error('STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET must be set to refresh the token.');
  }
  const fresh = await exchangeToken({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refresh,
  });
  storeTokens(fresh);
  return fresh.access_token;
}

interface StravaActivity {
  id: number;
  type: string;
  name: string;
  moving_time: number; // seconds
  distance: number; // meters
  average_heartrate?: number;
  start_date: string; // ISO UTC
  start_date_local: string; // ISO in athlete's local tz
}

/** Pull runs from Strava, dedupe by stravaId. Returns number of imported sessions. */
export async function syncRuns(): Promise<number> {
  const token = await accessToken();
  const after = Number(getSetting(K_LAST_SYNC) ?? '0');

  const url = new URL('https://www.strava.com/api/v3/athlete/activities');
  url.searchParams.set('per_page', '100');
  if (after > 0) url.searchParams.set('after', String(after));

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Strava activities fetch failed (${res.status}): ${body}`);
  }
  const activities = (await res.json()) as StravaActivity[];
  const runs = activities.filter((a) => a.type === 'Run');

  const exists = db.prepare('SELECT 1 FROM sessions WHERE strava_id = ?');
  const insert = db.prepare(
    `INSERT INTO sessions
       (date, sport, source, status, duration_min, distance_km, avg_pace_sec_per_km, avg_hr, strava_id, note)
     VALUES (?, 'running', 'strava', 'done', ?, ?, ?, ?, ?, ?)`
  );

  let imported = 0;
  let newestEpoch = after;
  for (const a of runs) {
    const stravaId = String(a.id);
    if (exists.get(stravaId)) continue;
    const distanceKm = a.distance / 1000;
    const pace = distanceKm > 0 ? Math.round(a.moving_time / distanceKm) : null;
    insert.run(
      a.start_date_local.slice(0, 10),
      Math.round(a.moving_time / 60),
      Math.round(distanceKm * 100) / 100,
      pace,
      a.average_heartrate ?? null,
      stravaId,
      a.name ?? null
    );
    imported++;
    const epoch = Math.floor(new Date(a.start_date).getTime() / 1000);
    if (epoch > newestEpoch) newestEpoch = epoch;
  }
  if (newestEpoch > after) setSetting(K_LAST_SYNC, String(newestEpoch));
  return imported;
}

export const stravaRoutes = new Hono();

stravaRoutes.get('/auth-url', (c) => {
  const creds = envCreds();
  if (!creds) {
    return c.json(
      { error: 'Strava is not configured: set STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET in .env (see .env.example).' },
      400
    );
  }
  const url = new URL('https://www.strava.com/oauth/authorize');
  url.searchParams.set('client_id', creds.clientId);
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('approval_prompt', 'auto');
  url.searchParams.set('scope', 'activity:read_all');
  return c.json({ url: url.toString() });
});

stravaRoutes.get('/callback', async (c) => {
  const code = c.req.query('code');
  const creds = envCreds();
  if (!creds) {
    return c.json({ error: 'Strava is not configured: set STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET.' }, 400);
  }
  if (!code) {
    return c.redirect('/settings?strava=error');
  }
  const tokens = await exchangeToken({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    grant_type: 'authorization_code',
    code,
  });
  storeTokens(tokens);
  return c.redirect('/settings?strava=connected');
});

stravaRoutes.post('/sync', async (c) => {
  const imported = await syncRuns();
  return c.json({ imported });
});
