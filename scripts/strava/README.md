# Strava sync — setup guide

Imports Strava runs into Firestore `sessions` as done running workouts with rich
detail (pace, pauses, splits, HR, elevation). Runs hourly via GitHub Actions
(`.github/workflows/strava-sync.yml`); dedupes by `stravaId`, so reruns are safe.
First sync backfills ~90 days.

## 1. Strava API application

<https://www.strava.com/settings/api> → create an app (callback domain:
`localhost`). Note the **Client ID** and **Client Secret**.

## 2. Firebase service account

Google Cloud Console → your Firebase project → IAM & Admin → Service Accounts →
create one with role **Cloud Datastore User** → Keys → add JSON key → download.

## 3. GitHub Actions secrets

Repo → Settings → Secrets and variables → Actions:

| Secret | Value |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT` | full JSON key file contents |
| `CORNERMAN_UID` | your Firebase Auth uid (Firebase console → Authentication → Users) |
| `STRAVA_CLIENT_ID` | from step 1 |
| `STRAVA_CLIENT_SECRET` | from step 1 |

## 4. One-time authorization

```bash
STRAVA_CLIENT_ID=… STRAVA_CLIENT_SECRET=… \
FIREBASE_SERVICE_ACCOUNT="$(cat service-account.json)" \
npx tsx scripts/strava/authorize.ts
```

Open the printed URL, authorize, paste the redirect URL back. Tokens land in the
Firestore `integrations/strava` doc (clients are denied access by rules).

## 5. Deploy security rules

Add the `integrations` deny rule from `integrations/firestore-model.md` to your
Firestore rules and publish.

## 6. First sync

Actions → **Strava sync** → Run workflow. Check the log: it prints each imported
run. After that the hourly cron keeps it current; each success stamps
"last synced" in the app's Settings screen.

## Local run

Same env vars as step 4 plus `CORNERMAN_UID`, then:

```bash
npx tsx scripts/strava/sync.ts
```
