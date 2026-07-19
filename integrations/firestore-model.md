# Cornerman — Firestore data model (source of truth)

Single-user-per-account fitness app. Static React PWA on GitHub Pages talks to Firestore
directly via the Firebase Web SDK. Auth = Firebase Auth (Google sign-in). A GitHub Actions
cron (`scripts/strava/sync.ts`) writes Strava runs into the same `sessions` collection.
Exercises are NOT in Firestore — they are bundled static reference data
(`data/exercises.json`) shipped with the app.

All timestamps are ISO strings or Firestore Timestamps as noted. All dates are `YYYY-MM-DD`
in the user's local timezone (Europe/Amsterdam). Weeks are Monday-based.

## Collections

### `sessions/{autoId}`
One document per workout/session. Exercises and sets are EMBEDDED (denormalized) — no
subcollections. Mirrors the `Session` type in `shared/types.ts` with these changes:
- `id`: the Firestore document id (string) — replaces the old numeric id
- add `uid: string` — owner's Firebase Auth uid (REQUIRED, used by security rules)
- add `createdAt: Timestamp` (serverTimestamp) and `updatedAt: Timestamp`
- `exercises: SessionExercise[]` embedded; each `SessionExercise.id` and each
  `SetLog.id` become client-generated string ids (crypto.randomUUID()). `SessionExercise`
  stores `exerciseId` (string slug into the static exercise DB) — do NOT embed the full
  `Exercise` object in Firestore; the client hydrates `exercise` from the bundled JSON on read.

Document shape:
```
{
  uid: string,
  date: "2026-07-07",
  sport: "kickboxing"|"boxing"|"running"|"calisthenics"|"weightlifting"|"conditioning",
  source: "manual"|"generated"|"strava"|"anchor",
  status: "planned"|"in_progress"|"done"|"skipped",
  durationMin: number|null,
  rpe: number|null,
  note: string|null,
  location: "home"|"gym"|null,
  distanceKm: number|null,
  avgPaceSecPerKm: number|null,
  avgHr: number|null,
  stravaId: string|null,          // set by the Strava sync for runs; used to dedupe
  run: {                          // rich Strava detail; null for non-strava sessions
    movingTimeSec: number,
    elapsedTimeSec: number,       // pauses = elapsedTimeSec - movingTimeSec
    maxHr: number|null,
    avgCadence: number|null,      // steps/min (Strava per-leg value doubled at ingest)
    elevationGainM: number|null,
    calories: number|null,
    splits: [                     // per-km splits from Strava splits_metric
      { km: number, distanceM: number, paceSecPerKm: number|null,
        elevDiffM: number|null, avgHr: number|null }
    ]
  } | null,
  exercises: [                    // [] for non-strength sessions
    {
      id: string,                 // uuid
      exerciseId: string,         // slug into data/exercises.json
      order: number,
      targetSets: number,
      targetReps: [number, number],
      suggestedWeightKg: number|null,
      sets: [
        { id: string, setNumber: number, reps: number,
          weightKg: number|null, seconds: number|null, done: boolean }
      ]
    }
  ],
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### `settings/{uid}`
One document, id === the user's uid.
```
{
  uid: string,
  weeklyTarget: number,           // default 4
  anchors: [ { id: string, weekday: number, sport: Sport, time: "19:00", label: string } ],
  stravaConnected: boolean,       // flipped true by the sync after its first successful run
  stravaLastSyncAt: string|null   // ISO timestamp, stamped on every successful sync
}
```
Defaults created on first sign-in: weeklyTarget 4, anchors = kickboxing Tue(2)+Thu(4) 19:00
"Kickboxing class".

### `integrations/strava`
Single document owned by the Strava sync (Admin SDK only — clients are denied by rules).
```
{
  accessToken: string,
  refreshToken: string,           // Strava rotates these; sync persists the newest
  expiresAt: number,              // epoch seconds
  lastSyncEpoch: number,          // start_date epoch of the newest imported run
  updatedAt: Timestamp
}
```
Seeded once by `scripts/strava/authorize.ts`.

### `bodyweight/{uid}_{date}`
One document per weigh-in day. Document id is `${uid}_${date}` so re-logging the same day
overwrites, and an external sync (n8n, Health export) can upsert idempotently.
```
{
  uid: string,
  date: "2026-07-08",
  weightKg: number,               // one decimal
  updatedAt: Timestamp
}
```

## Security rules (Firestore)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /sessions/{id} {
      allow read: if request.auth != null && resource.data.uid == request.auth.uid;
      allow create: if request.auth != null && request.resource.data.uid == request.auth.uid;
      allow update, delete: if request.auth != null && resource.data.uid == request.auth.uid;
    }
    match /settings/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    // Strava tokens — Admin SDK only, never client-readable.
    match /integrations/{id} {
      allow read, write: if false;
    }
    match /bodyweight/{id} {
      allow read: if request.auth != null && resource.data.uid == request.auth.uid;
      allow create: if request.auth != null && request.resource.data.uid == request.auth.uid;
      allow update, delete: if request.auth != null && resource.data.uid == request.auth.uid;
    }
  }
}
```

## GitHub Actions → Firestore (Strava sync)
`scripts/strava/sync.ts`, run hourly by `.github/workflows/strava-sync.yml` (plus a manual
`workflow_dispatch` trigger). Secrets live in GitHub Actions; Strava tokens live in
`integrations/strava` (Strava rotates refresh tokens, so they must be writable). Per run:
1. Refresh the Strava access token when near expiry; persist the rotated pair.
2. Fetch activities after `lastSyncEpoch` (first run: 90-day backfill); keep
   `sport_type` `Run`/`TrailRun`.
3. Dedupe by `stravaId`, then fetch `GET /activities/{id}` for detail and write a
   `sessions` doc: sport "running", source "strava", status "done",
   date = start_date_local (YYYY-MM-DD), durationMin = round(moving_time/60), distanceKm,
   avgPaceSecPerKm, avgHr, note = activity name, and the nested `run` detail above.
4. Advance `lastSyncEpoch`; stamp `stravaConnected` + `stravaLastSyncAt` on `settings/{uid}`.

One-time bootstrap: `scripts/strava/authorize.ts` (OAuth code exchange, seeds the token doc).
The app treats these like any other done session (counts toward weekly target + recovery).

## Apple Health → Firestore (bodyweight sync)
The Feelfit scale app syncs weigh-ins to Apple Health; a daily iOS Shortcut POSTs the latest
weight sample to an n8n webhook, which upserts `bodyweight/{uid}_{date}` (PATCH on the explicit
doc path — idempotent). Setup guide: `n8n/weight-to-firestore.README.md`. Manual entries from
the Progress screen write the exact same documents.

## Query patterns the client needs
- Today: sessions where uid==me and date==today (order by createdAt desc, take latest non-skipped).
- Week count: sessions where uid==me and date in [monday..sunday] and status=="done".
- History (Log): sessions where uid==me order by date desc (limit ~100).
- Dashboard: sessions where uid==me and date >= (12 weeks ago), status=="done".
Composite indexes may be required (uid + date, uid + createdAt) — document them in setup.
