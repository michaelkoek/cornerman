# Apple Health weight → Firestore (n8n + iOS Shortcuts) — setup guide

Pipes daily weigh-ins from the Feelfit scale into the Cornerman `bodyweight` Firestore
collection, no manual entry needed:

```
Feelfit app ──(built-in sync)──► Apple Health ──(iOS Shortcut, daily)──► n8n webhook ──► Firestore bodyweight/{uid}_{date}
```

The document shape and security rules live in [`../firestore-model.md`](../firestore-model.md).
The doc id is `{uid}_{date}`, so replays and re-runs are idempotent — the Shortcut can fire
as often as it likes.

Files:
- `weight-to-firestore.workflow.json` — importable n8n workflow (webhook → validate → upsert).
- `weight-to-firestore.README.md` — this guide.

---

## 1. Enable Feelfit → Apple Health sync

Feelfit → **Me / Settings → Data sharing (Apple Health)** → allow **Weight**. From then on
every weigh-in on the scale lands in Apple Health automatically. Verify: Health app →
Browse → Body Measurements → Weight shows the latest measurement with source "Feelfit".

---

## 2. Import + configure the n8n workflow

1. n8n → **Workflows → Import from File** → `weight-to-firestore.workflow.json`.
2. Open **Upsert weight doc** and pick the existing **Google API** service-account
   credential (the same one the Strava workflow uses — scope
   `https://www.googleapis.com/auth/datastore` already covers this).
3. Fill in the **Config** node:

   | Field               | Value                                                         |
   |---------------------|---------------------------------------------------------------|
   | `firebaseProjectId` | Same project id as the Strava workflow                       |
   | `uid`               | Michael's Firebase Auth uid (same as the Strava workflow)    |
   | `sharedSecret`      | A long random string, e.g. output of `openssl rand -hex 24`  |

4. Save + toggle **Active**. Copy the **Production URL** from the Weight webhook node —
   something like `https://<your-n8n>/webhook/cornerman-weight`.

> The webhook rejects requests whose `x-cornerman-secret` header doesn't match
> `sharedSecret` (the Validate node throws, nothing is written). Since the webhook URL is
> internet-reachable, don't skip the secret.

### Test from the terminal

```bash
curl -X POST https://<your-n8n>/webhook/cornerman-weight \
  -H 'Content-Type: application/json' \
  -H 'x-cornerman-secret: YOUR_SECRET' \
  -d '{"date":"2026-07-08","weightKg":82.4}'
```

Expected: 200 response, a new `bodyweight` doc in the Firebase console, and the weigh-in
visible on the Progress screen after a reload.

---

## 3. Build the iOS Shortcut

Shortcuts app → **+** → name it **Sync weight**. Add these actions in order:

1. **Find Health Samples** (action: "Find All Health Samples where…")
   - Sample type: **Weight**
   - Sort by: **Start Date**, Order: **Latest First**
   - **Limit: 1**
2. **If** — Input: `Health Samples`, Condition: **has any value**
   (everything below goes inside the If branch; add a **Stop This Shortcut** in Otherwise).
3. **Format Date**
   - Date: the sample's **Start Date** (tap the variable → select Start Date)
   - Format: **Custom** → `yyyy-MM-dd`
4. **Get Contents of URL**
   - URL: your webhook URL from step 2
   - Method: **POST**
   - Headers: `x-cornerman-secret` = your `sharedSecret`
   - Request Body: **JSON** with two fields:
     - `date` (Text) = `Formatted Date`
     - `weightKg` (Number) = the **Health Sample** magic variable (its numeric value;
       Health stores weight in kg, and the n8n side also normalises a `82,4` comma string,
       so either representation works)

Run it once by hand — check the n8n execution log and the Progress screen.

### Automate it

Shortcuts → **Automation** tab → **+** → **Time of Day** → e.g. **09:00, Daily** →
**Run Immediately** (not "Ask Before Running") → action: **Run Shortcut → Sync weight**.

Since the payload carries the *sample's* date, a morning weigh-in synced later the same
day (or even the next day) still lands on the correct date.

---

## Limitations / notes

- The Shortcut sends only the **latest** sample. With a daily automation plus daily(ish)
  weigh-ins that covers everything; a skipped automation day at most loses the oldest of two
  weigh-ins, and manual entry on the Progress screen fills any gap.
- Re-logging the same date — from the scale, the Shortcut, or the app — just overwrites that
  day's doc (`{uid}_{date}`), so there are never duplicates.
- The app also lets you log/correct weight manually on the Progress screen; sync and manual
  entry write the exact same documents.
