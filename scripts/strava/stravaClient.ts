// Thin Strava HTTP client used by sync.ts and authorize.ts.
import type { IStravaActivityDetail, IStravaActivitySummary } from './map.ts';

const TOKEN_URL = 'https://www.strava.com/oauth/token';
const API_BASE = 'https://www.strava.com/api/v3';

export interface IStravaTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch seconds
}

export interface IStravaAppCreds {
  clientId: string;
  clientSecret: string;
}

interface ITokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

async function requestTokens(params: Record<string, string>): Promise<IStravaTokens> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Strava token request failed (${res.status}): ${body}`);
  }
  const data = (await res.json()) as ITokenResponse;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at,
  };
}

export async function exchangeAuthCode(creds: IStravaAppCreds, code: string): Promise<IStravaTokens> {
  return requestTokens({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    grant_type: 'authorization_code',
    code,
  });
}

export async function refreshTokens(creds: IStravaAppCreds, refreshToken: string): Promise<IStravaTokens> {
  return requestTokens({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
}

async function apiGet<T>(accessToken: string, path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${API_BASE}${path}`);
  for (const [key, value] of Object.entries(params ?? {})) {
    url.searchParams.set(key, value);
  }
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Strava GET ${path} failed (${res.status}): ${body}`);
  }
  return (await res.json()) as T;
}

/** All activities after `afterEpochSec`, paging until Strava returns an empty page. */
export async function listActivitiesAfter(
  accessToken: string,
  afterEpochSec: number,
): Promise<IStravaActivitySummary[]> {
  const all: IStravaActivitySummary[] = [];
  for (let page = 1; page <= 10; page++) {
    const batch = await apiGet<IStravaActivitySummary[]>(accessToken, '/athlete/activities', {
      after: String(afterEpochSec),
      per_page: '100',
      page: String(page),
    });
    all.push(...batch);
    if (batch.length < 100) {
      break;
    }
  }
  return all;
}

export async function getActivityDetail(accessToken: string, id: number): Promise<IStravaActivityDetail> {
  return apiGet<IStravaActivityDetail>(accessToken, `/activities/${id}`);
}

export function authorizeUrl(clientId: string): string {
  const url = new URL('https://www.strava.com/oauth/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', 'http://localhost');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('approval_prompt', 'force');
  url.searchParams.set('scope', 'activity:read_all');
  return url.toString();
}
