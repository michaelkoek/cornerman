// One-time Strava OAuth bootstrap. Run locally:
//   STRAVA_CLIENT_ID=… STRAVA_CLIENT_SECRET=… FIREBASE_SERVICE_ACCOUNT="$(cat key.json)" \
//     npx tsx scripts/strava/authorize.ts
//
// Prints the authorize URL, waits for the pasted redirect URL (or bare code),
// exchanges it for tokens, and seeds the Firestore `integrations/strava` doc.
import { createInterface } from 'node:readline/promises';
import { authorizeUrl, exchangeAuthCode } from './stravaClient.ts';
import { initFirestore, requiredEnv, writeTokens } from './store.ts';

function extractCode(input: string): string {
  const trimmed = input.trim();
  try {
    const code = new URL(trimmed).searchParams.get('code');
    if (code) {
      return code;
    }
  } catch {
    // Not a URL — treat the input as the bare code.
  }
  return trimmed;
}

async function main(): Promise<void> {
  const clientId = requiredEnv('STRAVA_CLIENT_ID');
  const clientSecret = requiredEnv('STRAVA_CLIENT_SECRET');
  const db = initFirestore();

  console.log('\n1. Open this URL and click Authorize:\n');
  console.log(`   ${authorizeUrl(clientId)}\n`);
  console.log('2. You land on an http://localhost/?code=… page that fails to load — that is fine.');
  console.log('3. Paste the full redirect URL (or just the code) below.\n');

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question('Redirect URL or code: ');
  rl.close();

  const code = extractCode(answer);
  if (!code) {
    throw new Error('No authorization code provided.');
  }

  const tokens = await exchangeAuthCode({ clientId, clientSecret }, code);
  await writeTokens(db, tokens);
  console.log('\nTokens stored in Firestore (integrations/strava).');
  console.log('The GitHub Actions sync can now run — trigger it manually or wait for the hourly cron.');
}

main().catch((error: unknown) => {
  console.error('Authorization failed:', error);
  process.exitCode = 1;
});
