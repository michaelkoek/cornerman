# Strava Sync — Design

**Date:** 2026-07-19
**Status:** Approved

## Goal

Runs logged in Strava appear automatically in Cornerman's Log, count as completed
workouts (weekly target + streak), and open into a rich run-detail view (distance,
pace, pauses, heart rate, splits, elevation, cadence, calories).

## Decision

Sync runs via a **TypeScript script executed by GitHub Actions on an hourly cron**
(plus manual trigger), writing directly to Firestore with the Admin SDK.

Rejected alternatives:

- **n8n workflow** (existing `integrations/n8n/strava-to-firestore.workflow.json`):
  instance not active; rich-detail fetch would mean rebuilding most logic in
  workflow-JSON nodes; secrets in plaintext Set node; refresh-token rotation manual.
- **Firebase Cloud Function + Strava webhook**: near-realtime but requires Blaze
  billing plan, webhook subscription management, and a public callback endpoint —
  overkill for a single athlete. Hourly latency is acceptable.

## Architecture

```
GitHub Actions (cron hourly + workflow_dispatch)
  └─ scripts/strava/sync.ts (tsx, firebase-admin)
       ├─ Firestore integrations/strava  — tokens + lastSyncEpoch (admin-only)
       ├─ Strava API                     — activities list + per-activity detail
       └─ Firestore sessions             — one doc per run (dedupe by stravaId)
```

### Components

1. **`scripts/strava/sync.ts`** — sync engine:
   - Load `{ accessToken, refreshToken, expiresAt, lastSyncEpoch }` from Firestore
     doc `integrations/strava`.
   - Refresh access token when within 60s of expiry; persist rotated refresh token
     back to the same doc. (Strava rotates refresh tokens — this is why tokens live
     in Firestore rather than GitHub secrets, which a workflow cannot self-update.)
   - `GET /api/v3/athlete/activities?after=<lastSyncEpoch>&per_page=100`.
     First run (no marker): `after = now − 90 days` (~3-month backfill).
   - Keep activities with `sport_type` `Run` or `TrailRun`.
   - Dedupe: query `sessions` where `uid == UID` and `stravaId == String(id)`; skip
     when present. Reruns are idempotent.
   - Per new run: `GET /api/v3/activities/{id}` for `splits_metric`, `max_heartrate`,
     `calories`, `average_cadence`, `total_elevation_gain`, `elapsed_time`.
   - Write `sessions` doc (shape below). `status: "done"` makes it count toward
     weekly target and streak with zero engine changes.
   - After all writes succeed: advance `lastSyncEpoch` to newest activity's
     `start_date`; set `stravaConnected: true` and `stravaLastSyncAt` on
     `settings/{uid}`.
   - Config via env: `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`,
     `FIREBASE_SERVICE_ACCOUNT` (JSON), `CORNERMAN_UID`.

2. **`scripts/strava/authorize.ts`** — one-time local bootstrap:
   prints the Strava OAuth URL (`scope=activity:read_all`), prompts for the `code`
   from the redirect URL, exchanges it, seeds the `integrations/strava` doc.

3. **`.github/workflows/strava-sync.yml`**:
   - `schedule: cron '7 * * * *'` + `workflow_dispatch`.
   - Node 22, `npm ci`, run script with secrets:
     `FIREBASE_SERVICE_ACCOUNT`, `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`,
     `CORNERMAN_UID`.
   - Non-zero exit on failure → red run + GitHub notification email.

4. **`firebase-admin`** added as a devDependency (used only by scripts, never
   bundled into the PWA).

## Data model

`Session` (shared/types.ts) gains one nullable nested field:

```ts
interface IRunSplit {
  km: number                    // 1-based split index
  distanceM: number             // actual metres in split (last split may be short)
  paceSecPerKm: number | null
  elevDiffM: number | null
  avgHr: number | null
}

interface IRunDetail {
  movingTimeSec: number
  elapsedTimeSec: number        // pauses = elapsedTimeSec − movingTimeSec
  maxHr: number | null
  avgCadence: number | null    // steps/min (Strava reports per-leg; ×2 for spm)
  elevationGainM: number | null
  calories: number | null
  splits: IRunSplit[]
}

// Session: run: IRunDetail | null   (null for all non-Strava sessions)
```

Existing top-level fields stay as-is and keep powering Log rows and the dashboard:
`distanceKm`, `avgPaceSecPerKm`, `avgHr`, `stravaId`, `durationMin`
(= round(moving_time / 60)). Activity name → `note`.

Firestore doc mapping mirrors the interface (`run` map field, `splits` array of
maps). `src/lib/db.ts` doc↔Session mapping extended; missing/absent `run` reads
as `null` so existing docs are unaffected.

## Security

- `integrations/strava` doc: Firestore security rules deny all client access
  (`allow read, write: if false;` for `integrations/**`). Only the Admin SDK
  (service account) touches it.
- Service-account key + Strava client secrets live in GitHub Actions secrets.
- `firestore-model.md` updated with the new `run` field, the `integrations`
  collection, and the rules note.

## UI

1. **`src/components/runDetail/RunDetail.tsx`** (new, own folder if split needed;
   250-line file limit): rendered inside `WorkoutDetailSheet` when
   `session.run != null`.
   - Hero stats: distance, moving time, avg pace.
   - Stat grid: pause time (elapsed − moving, hidden when 0), avg HR / max HR,
     elevation gain, cadence, calories — null fields omitted.
   - Splits: per-km list, pace text + horizontal pace bar scaled to
     fastest/slowest split, elevation diff. Follows existing sheet/card CSS
     patterns in `app.css`; semantic markup (`<section>`, list semantics),
     screen-reader-friendly labels.
2. **Log rows**: unchanged — `sessionStats()` already renders distance + pace for
   running sessions; title already shows "Run · Strava".
3. **Settings → Strava section**: connected dot now driven by real
   `stravaConnected`; add "Last synced …" line from `stravaLastSyncAt`.
   No connect button in-app (authorization is the one-time local script).

## Error handling

- Every Strava/Firestore call: `try/catch` with contextual `console.error`, then
  rethrow → script exits non-zero → visible red Actions run.
- Token refresh failure → clear actionable message ("re-run authorize script").
- Partial-import safety: session writes happen before the `lastSyncEpoch`
  advance; dedupe makes any rerun idempotent.
- Strava rate limits (200 req/15 min): 90-day backfill of runs stays far below;
  detail calls are 1 per new run.

## Cleanup

- Delete `integrations/n8n/strava-to-firestore.workflow.json` and its README
  (superseded); `weight-to-firestore` workflow files stay.
- `server/strava.ts` (legacy SQLite-era server) left untouched — the whole
  `server/` dir is legacy and out of scope.

## Testing

- Sync mapping logic (activity → session doc, split mapping, pace math, dedupe
  window) extracted into pure functions in `scripts/strava/map.ts` so they are
  testable without network/Firestore.
- Manual verification: run `authorize.ts`, run `sync.ts` locally with env vars,
  confirm docs in Firestore emulator/console, open app → Log shows runs, detail
  sheet shows stats, Settings shows connected + last sync.

## Manual setup checklist (user)

1. Strava API app (client id/secret) — reuse from n8n attempt if created.
2. Firebase service-account key (Cloud Datastore User role) — per old n8n README.
3. Add 4 GitHub Actions secrets.
4. Run `npx tsx scripts/strava/authorize.ts` locally once.
5. Deploy updated Firestore security rules.
