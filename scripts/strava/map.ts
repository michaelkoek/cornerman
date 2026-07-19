// Pure Strava -> Firestore mapping. No network, no Firestore — unit-testable.
import type { IRunDetail, IRunSplit } from '../../shared/types.ts';

/** Summary activity from GET /athlete/activities. */
export interface IStravaActivitySummary {
  id: number;
  name: string;
  sport_type: string;
  distance: number; // metres
  moving_time: number; // seconds
  elapsed_time: number; // seconds
  average_heartrate?: number;
  start_date: string; // ISO UTC
  start_date_local: string; // ISO in athlete's local tz
}

/** Extra fields from GET /activities/{id} (detailed activity). */
export interface IStravaActivityDetail extends IStravaActivitySummary {
  max_heartrate?: number;
  average_cadence?: number; // per-leg steps/min
  total_elevation_gain?: number; // metres
  calories?: number;
  splits_metric?: IStravaSplit[];
}

export interface IStravaSplit {
  split: number; // 1-based index
  distance: number; // metres
  moving_time: number; // seconds
  elevation_difference?: number | null;
  average_heartrate?: number;
}

/** Firestore `sessions` doc payload for a synced run (without uid/timestamps). */
export interface IRunSessionDoc {
  date: string;
  sport: 'running';
  source: 'strava';
  status: 'done';
  durationMin: number;
  rpe: null;
  note: string | null;
  location: null;
  distanceKm: number;
  avgPaceSecPerKm: number | null;
  avgHr: number | null;
  stravaId: string;
  run: IRunDetail;
  exercises: [];
}

const RUN_SPORT_TYPES = ['Run', 'TrailRun'] as const;

export function isRun(activity: IStravaActivitySummary): boolean {
  return (RUN_SPORT_TYPES as readonly string[]).includes(activity.sport_type);
}

function paceSecPerKm(movingTimeSec: number, distanceM: number): number | null {
  if (distanceM <= 0) {
    return null;
  }
  return Math.round(movingTimeSec / (distanceM / 1000));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function toRunSplit(split: IStravaSplit): IRunSplit {
  return {
    km: split.split,
    distanceM: Math.round(split.distance),
    paceSecPerKm: paceSecPerKm(split.moving_time, split.distance),
    elevDiffM: split.elevation_difference != null ? round1(split.elevation_difference) : null,
    avgHr: split.average_heartrate != null ? Math.round(split.average_heartrate) : null,
  };
}

export function toRunDetail(detail: IStravaActivityDetail): IRunDetail {
  return {
    movingTimeSec: detail.moving_time,
    elapsedTimeSec: detail.elapsed_time,
    maxHr: detail.max_heartrate != null ? Math.round(detail.max_heartrate) : null,
    // Strava reports running cadence per leg; double it to steps/min.
    avgCadence: detail.average_cadence != null ? Math.round(detail.average_cadence * 2) : null,
    elevationGainM: detail.total_elevation_gain != null ? round1(detail.total_elevation_gain) : null,
    calories: detail.calories != null ? Math.round(detail.calories) : null,
    splits: (detail.splits_metric ?? []).map(toRunSplit),
  };
}

export function toSessionDoc(detail: IStravaActivityDetail): IRunSessionDoc {
  const distanceKm = Math.round((detail.distance / 1000) * 100) / 100;
  return {
    date: detail.start_date_local.slice(0, 10),
    sport: 'running',
    source: 'strava',
    status: 'done',
    durationMin: Math.round(detail.moving_time / 60),
    rpe: null,
    note: detail.name || null,
    location: null,
    distanceKm,
    avgPaceSecPerKm: paceSecPerKm(detail.moving_time, detail.distance),
    avgHr: detail.average_heartrate != null ? Math.round(detail.average_heartrate) : null,
    stravaId: String(detail.id),
    run: toRunDetail(detail),
    exercises: [],
  };
}

export function startEpochSec(activity: IStravaActivitySummary): number {
  return Math.floor(new Date(activity.start_date).getTime() / 1000);
}
