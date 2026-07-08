# Cornerman — Firestore data model (source of truth)

Single-user-per-account fitness app. Static React PWA on GitHub Pages talks to Firestore
directly via the Firebase Web SDK. Auth = Firebase Auth (Google sign-in). n8n writes Strava
runs into the same `sessions` collection. Exercises are NOT in Firestore — they are bundled
static reference data (`data/exercises.json`) shipped with the app.

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
  stravaId: string|null,          // set by n8n for runs; used to dedupe
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
  stravaConnected: boolean        // flipped true once n8n has tokens (or user toggles)
}
```
Defaults created on first sign-in: weeklyTarget 4, anchors = kickboxing Tue(2)+Thu(4) 19:00
"Kickboxing class".

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
    match /bodyweight/{id} {
      allow read: if request.auth != null && resource.data.uid == request.auth.uid;
      allow create: if request.auth != null && request.resource.data.uid == request.auth.uid;
      allow update, delete: if request.auth != null && resource.data.uid == request.auth.uid;
    }
  }
}
```

## n8n → Firestore (Strava sync)
n8n owns the Strava OAuth client secret and refresh token. On a cron (every ~3h) it:
1. Refreshes the Strava access token.
2. Fetches new activities of type `Run` after the last synced start date.
3. For each run, upserts a `sessions` doc with: uid = Michael's fixed uid (configured in n8n),
   sport "running", source "strava", status "done", date = start_date_local (YYYY-MM-DD),
   durationMin = round(moving_time/60), distanceKm, avgPaceSecPerKm = moving_time/distanceKm,
   avgHr (nullable), stravaId = String(activity.id), exercises: [].
   Dedupe by `stravaId` (query existing where uid==… and stravaId==id; skip if present).

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
