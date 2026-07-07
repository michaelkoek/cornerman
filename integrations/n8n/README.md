# Strava → Firestore sync (n8n) — setup guide

This n8n workflow pulls Michael's Strava **runs** every 3 hours and writes them into the
Cornerman `sessions` Firestore collection as `sport: "running"`, `source: "strava"`,
`status: "done"` documents, deduped by `stravaId`. It honours the exact document shape in
[`../firestore-model.md`](../firestore-model.md).

Files:
- `strava-to-firestore.workflow.json` — importable n8n workflow.
- `README.md` — this guide.

---

## Node chain (what the workflow does)

```
Every 3 hours (cron)  ┐
Manual backfill       ┘──► Config (Set: your values)
                              └► Refresh Strava token (POST /oauth/token)
                                   └► Compute after epoch (Code: static-data marker)
                                        └► Get activities (GET /athlete/activities?after=…&per_page=50)
                                             └► Split activities
                                                  └► Only Runs (type == "Run")
                                                       └► Check existing by stravaId (Firestore runQuery)
                                                            └► Skip if exists (drop already-synced)
                                                                 └► Build Firestore doc (Code: typed values)
                                                                      └► Create session doc (POST /documents/sessions)
                                                                           └► Advance last synced (Code: persist epoch)
```

---

## 1. Register a Strava API application

1. Go to <https://www.strava.com/settings/api> and create an application.
   - **Authorization Callback Domain:** `localhost` (any value works for a personal script).
2. Note the **Client ID** and **Client Secret**.

### One-time OAuth to obtain a `refresh_token` (scope `activity:read_all`)

Strava's refresh flow needs a refresh token that you mint once by hand.

**Step A — authorize in a browser.** Paste this URL (replace `YOUR_CLIENT_ID`), open it,
click **Authorize**:

```
https://www.strava.com/oauth/authorize?client_id=YOUR_CLIENT_ID&response_type=code&redirect_uri=http://localhost&approval_prompt=force&scope=activity:read_all
```

You'll be redirected to something like `http://localhost/?state=&code=THE_CODE&scope=read,activity:read_all`.
The page will fail to load (there's no server on localhost) — that's fine. Copy the
**`code`** value out of the address bar.

**Step B — exchange the code for tokens.** Run (replace all three placeholders):

```bash
curl -sX POST https://www.strava.com/oauth/token \
  -d client_id=YOUR_CLIENT_ID \
  -d client_secret=YOUR_CLIENT_SECRET \
  -d code=THE_CODE \
  -d grant_type=authorization_code
```

The JSON response contains `refresh_token`, `access_token`, and `expires_at`. **Copy the
`refresh_token`** — that's the long-lived value you paste into the workflow. (The workflow
refreshes the short-lived `access_token` itself on every run.)

> Confirm the granted scope includes `activity:read_all`. Without it, private/followers-only
> runs won't be returned.

---

## 2. Create a Google service account for Firestore

1. Google Cloud Console → your Firebase project → **IAM & Admin → Service Accounts →
   Create service account**.
2. Grant the role **Cloud Datastore User** (`roles/datastore.user`) — this covers Firestore
   read + write. (`Firebase Admin` also works but is broader than needed.)
3. On the new service account → **Keys → Add key → Create new key → JSON**. Download the
   JSON key file.

### Add it as a Google API credential in n8n

1. In n8n → **Credentials → New → "Google API"** (the generic OAuth2/service-account Google
   credential; internal type `googleApi`).
2. Choose **Service Account** authentication.
3. Paste:
   - **Service Account Email** = `client_email` from the JSON.
   - **Private Key** = the `private_key` value from the JSON (keep the `-----BEGIN PRIVATE
     KEY-----` header/footer and the `\n` line breaks intact).
   - **Scope** = `https://www.googleapis.com/auth/datastore`
4. Save. Both Firestore HTTP nodes ("Check existing by stravaId" and "Create session doc")
   are pre-wired to use a `googleApi` credential — after import, open each node once and
   pick this credential from the dropdown.

---

## 3. Get Michael's Firebase Auth uid

1. Sign into the Cornerman PWA once with Google (this creates the Firebase Auth user + the
   `settings/{uid}` doc).
2. Firebase Console → **Authentication → Users** → find the account
   (michaelkoek@gmail.com) → copy the **User UID**.
3. Paste it into the Config node's `uid` field. Every synced run gets `uid = <that value>`
   so it attaches to Michael's account and passes the security rules.

---

## 4. Fill in the Config node

Import the workflow (next section), then open the **Config** node and replace each
placeholder:

| Config field          | Paste this                                                        |
|-----------------------|-------------------------------------------------------------------|
| `stravaClientId`      | Strava app **Client ID** (step 1)                                 |
| `stravaClientSecret`  | Strava app **Client Secret** (step 1)                             |
| `stravaRefreshToken`  | `refresh_token` from the OAuth exchange (step 1B)                 |
| `firebaseProjectId`   | Your Firebase / GCP **project id** (e.g. `cornerman-xxxx`)        |
| `uid`                 | Michael's Firebase Auth **uid** (step 3)                          |
| `backfillDays`        | How far back the *first* run looks (default `30`)                 |

> These live in a plaintext Set node for easy editing. If you prefer, move the three Strava
> secrets into n8n **environment variables** and reference them with
> `{{ $env.STRAVA_CLIENT_SECRET }}` instead of the literal — the workflow's expression
> references (`$('Config').item.json.…`) will still work as long as Config exposes the value.

---

## 5. Import and activate

1. n8n → **Workflows → Import from File** → select `strava-to-firestore.workflow.json`.
2. Assign the **Google API** credential on both Firestore HTTP nodes (see step 2).
3. Fill in the **Config** node (step 4).
4. Click **Save**.
5. Toggle **Active** (top-right). The **Every 3 hours** Schedule Trigger now runs the sync
   automatically.

### Manual run / backfill

- Use the **Manual backfill** trigger: open the workflow and click **Execute Workflow** (or
  trigger the Manual node). On the very first execution — before any `lastSyncedEpoch` marker
  exists — the workflow fetches activities from `now - backfillDays`. Bump `backfillDays` in
  Config (e.g. to `365`) for a bigger historical backfill, run once manually, then set it
  back down.

---

## 6. Dedupe strategy & cadence (how it stays correct)

- **Dedupe:** before creating a doc, the workflow issues a Firestore `runQuery` filtering
  `uid == <uid> AND stravaId == String(activity.id)`, `limit 1`. If a matching `sessions`
  document already exists, the item is dropped by the **Skip if exists** filter and no new
  doc is written. So re-processing the same activity is a no-op — safe to run as often as you
  like.
- **"Last synced" marker:** stored in n8n **workflow static data** (`lastSyncedEpoch`,
  unix seconds). "Advance last synced" sets it to the newest fetched run's `start_date`.
  Because dedupe is the real safety net, if a cycle finds only already-synced runs the marker
  simply doesn't advance and the next cycle re-queries the same small window and re-dedupes —
  correct, just slightly redundant. The window is bounded (it only extends back to the last
  *written* run), so cost stays low.
- **Cadence:** the Schedule Trigger fires every **3 hours**. `per_page=50` comfortably covers
  a 3-hour window (and any backlog after downtime).
- **Reset the marker:** to force a re-scan from scratch, clear the workflow's static data
  (n8n stores it per-workflow; deleting + re-importing the workflow, or clearing static data
  via the API, resets `lastSyncedEpoch`). Existing docs are still protected by dedupe.

### Strava refresh-token rotation

Strava **may** return a new `refresh_token` in the `/oauth/token` response. When it does, the
old one keeps working for a while but you should update Config → `stravaRefreshToken` with the
new value to be safe. Watch the "Refresh Strava token" node output; if `refresh_token` differs
from what's in Config, paste the new one in. (For a fully hands-off setup, replace the Config
value with an n8n credential/DB write-back — out of scope for this minimal version.)

---

## Field mapping (Strava → `sessions` doc)

Built in the **Build Firestore doc** Code node as Firestore REST typed values:

| Firestore field    | Type              | Source                                                        |
|--------------------|-------------------|---------------------------------------------------------------|
| `uid`              | stringValue       | Config `uid`                                                  |
| `date`             | stringValue       | `start_date_local` sliced to `YYYY-MM-DD`                     |
| `sport`            | stringValue       | constant `"running"`                                          |
| `source`           | stringValue       | constant `"strava"`                                           |
| `status`           | stringValue       | constant `"done"`                                             |
| `durationMin`      | integerValue      | `round(moving_time / 60)`                                     |
| `rpe`              | nullValue         | `null`                                                        |
| `note`             | nullValue         | `null`                                                        |
| `location`         | nullValue         | `null`                                                        |
| `distanceKm`       | doubleValue       | `distance / 1000` (Strava distance is metres)                |
| `avgPaceSecPerKm`  | integerValue/null | `round(moving_time / distanceKm)` (null if distance 0)       |
| `avgHr`            | doubleValue/null  | `average_heartrate` (null when Strava omits it)              |
| `stravaId`         | stringValue       | `String(activity.id)` — the dedupe key                       |
| `exercises`        | arrayValue []     | empty                                                         |
| `createdAt`        | timestampValue    | now (ISO)                                                     |
| `updatedAt`        | timestampValue    | now (ISO)                                                     |

> `createdAt`/`updatedAt` are set to the ingest time via `timestampValue`. The app's own
> writes use `serverTimestamp()`; both resolve to real Firestore Timestamps, so reads are
> consistent. If you'd rather Firestore stamp the server time, that requires a
> `commit`-with-transform call — the ISO timestamp is accurate enough for this feed.

---

## Firestore composite indexes

The dedupe `runQuery` filters on `uid` + `stravaId` (both equality) — equality-only
composite filters do **not** require a custom index. The client-side query patterns in
`firestore-model.md` (`uid` + `date`, `uid` + `createdAt`) still need the composite indexes
documented there; those are unrelated to this sync.

---

## Troubleshooting

- **`Split activities` returns nothing / errors:** the HTTP Request node normally wraps the
  returned array under a `data` key (hence `Field to Split Out = data`). If your n8n version
  returns the array as top-level items instead, delete the Split node and connect
  `Get activities → Only Runs` directly (each activity already becomes its own item).
- **401 from Strava `/athlete/activities`:** the access token didn't refresh — re-check the
  Client ID/Secret/refresh token in Config, and that the scope was `activity:read_all`.
- **403 from Firestore:** the service account is missing `Cloud Datastore User`, or the
  `firebaseProjectId` is wrong.
- **Duplicate docs appearing:** confirm both Firestore nodes point at the same project and
  that `uid` in Config matches the value written into the docs.
