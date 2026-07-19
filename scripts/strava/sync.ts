// Cornerman Strava sync — run by GitHub Actions (hourly cron + manual trigger).
// Pulls new Strava runs and writes them to Firestore as done running sessions
// with rich run detail. Idempotent: dedupes by stravaId, so reruns are safe.
//
// Env: FIREBASE_SERVICE_ACCOUNT, CORNERMAN_UID, STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET.
import { isRun, startEpochSec, toSessionDoc } from './map.ts';
import {
  getActivityDetail,
  listActivitiesAfter,
  refreshTokens,
  type IStravaAppCreds,
  type IStravaTokens,
} from './stravaClient.ts';
import {
  createRunSession,
  initFirestore,
  markSynced,
  readSyncState,
  requiredEnv,
  sessionExists,
  writeLastSyncEpoch,
  writeTokens,
} from './store.ts';

const BACKFILL_DAYS = 90;
const TOKEN_EXPIRY_MARGIN_SEC = 60;

async function ensureFreshTokens(
  db: ReturnType<typeof initFirestore>,
  creds: IStravaAppCreds,
  tokens: IStravaTokens,
): Promise<IStravaTokens> {
  const now = Math.floor(Date.now() / 1000);
  if (tokens.expiresAt - TOKEN_EXPIRY_MARGIN_SEC > now) {
    return tokens;
  }
  try {
    const fresh = await refreshTokens(creds, tokens.refreshToken);
    // Strava rotates refresh tokens — always persist the newest pair.
    await writeTokens(db, fresh);
    return fresh;
  } catch (error) {
    console.error('Strava token refresh failed. Re-run `npx tsx scripts/strava/authorize.ts`.');
    throw error;
  }
}

async function main(): Promise<void> {
  const creds: IStravaAppCreds = {
    clientId: requiredEnv('STRAVA_CLIENT_ID'),
    clientSecret: requiredEnv('STRAVA_CLIENT_SECRET'),
  };
  const uid = requiredEnv('CORNERMAN_UID');
  const db = initFirestore();

  const state = await readSyncState(db);
  const tokens = await ensureFreshTokens(db, creds, state);

  const after =
    state.lastSyncEpoch > 0
      ? state.lastSyncEpoch
      : Math.floor(Date.now() / 1000) - BACKFILL_DAYS * 24 * 60 * 60;

  const activities = await listActivitiesAfter(tokens.accessToken, after);
  const runs = activities.filter(isRun);
  console.log(`Fetched ${activities.length} activities since ${new Date(after * 1000).toISOString()}; ${runs.length} runs.`);

  let imported = 0;
  let newestEpoch = state.lastSyncEpoch;
  for (const run of runs) {
    const stravaId = String(run.id);
    if (await sessionExists(db, uid, stravaId)) {
      continue;
    }
    const detail = await getActivityDetail(tokens.accessToken, run.id);
    await createRunSession(db, uid, toSessionDoc(detail));
    imported++;
    console.log(`Imported run ${stravaId}: ${detail.name} (${detail.start_date_local.slice(0, 10)})`);
    const epoch = startEpochSec(run);
    if (epoch > newestEpoch) {
      newestEpoch = epoch;
    }
  }

  if (newestEpoch > state.lastSyncEpoch) {
    await writeLastSyncEpoch(db, newestEpoch);
  }
  await markSynced(db, uid);
  console.log(`Done. Imported ${imported} new run(s).`);
}

main().catch((error: unknown) => {
  console.error('Strava sync failed:', error);
  process.exitCode = 1;
});
