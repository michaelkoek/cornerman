// Personal-record math — pure functions over done sessions, no I/O.
// PRs are always derived (never stored): computePRs() builds the all-time
// baseline per exercise; baselineExcluding()/detectPr() run while logging so
// a set can be celebrated the moment it beats the record. Nothing here keeps
// state — every result is recomputed from the sessions passed in, so a
// mid-workout reload can never lose or double-count a record.

import type { Exercise, ExercisePR, Session, SessionExercise } from '../../shared/types'
import { fmtKg } from './format'

/** Epley estimated 1RM, rounded to 0.1 kg. */
export function epley(weightKg: number, reps: number): number {
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10
}

export type PrKind = 'weight' | 'reps' | 'est1rm' | 'seconds'

export interface LoggedSet {
  reps: number
  weightKg: number | null
  seconds: number | null
}

export function emptyPR(exerciseId: string): ExercisePR {
  return {
    exerciseId,
    maxWeightKg: null,
    maxWeightReps: null,
    maxReps: null,
    bestEst1Rm: null,
    maxSeconds: null,
    lastWeightKg: null,
    totalDoneSets: 0,
    lastDate: null,
  }
}

/**
 * Fold one done set into a baseline. Callers must fold oldest-first so
 * `lastWeightKg`/`lastDate` end up on the most recent set; a null `date`
 * (live logging, order unknown) always wins as "latest".
 */
export function foldSet(
  pr: ExercisePR,
  type: Exercise['type'],
  set: LoggedSet,
  date: string | null,
): ExercisePR {
  const next: ExercisePR = { ...pr, totalDoneSets: pr.totalDoneSets + 1 }
  if (date !== null) {
    next.lastDate = date
  }

  if (type === 'weighted') {
    const w = set.weightKg
    if (w != null && w > 0) {
      next.lastWeightKg = w
      if (next.maxWeightKg === null || w > next.maxWeightKg) {
        next.maxWeightKg = w
        next.maxWeightReps = set.reps
      } else if (w === next.maxWeightKg && set.reps > (next.maxWeightReps ?? 0)) {
        next.maxWeightReps = set.reps
      }
      const oneRm = epley(w, set.reps)
      if (next.bestEst1Rm === null || oneRm > next.bestEst1Rm) {
        next.bestEst1Rm = oneRm
      }
    }
  } else if (type === 'timed') {
    if (set.seconds != null && (next.maxSeconds === null || set.seconds > next.maxSeconds)) {
      next.maxSeconds = set.seconds
    }
  }

  // Max reps in a single set — tracked for weighted too (useful context).
  if (type !== 'timed' && (next.maxReps === null || set.reps > next.maxReps)) {
    next.maxReps = set.reps
  }
  return next
}

const toLoggedSet = (set: SessionExercise['sets'][number]): LoggedSet => ({
  reps: set.reps,
  weightKg: set.weightKg,
  seconds: set.seconds,
})

/** All-time PR baseline per exerciseId from done sessions (any sort order). */
export function computePRs(doneSessions: Session[]): Map<string, ExercisePR> {
  // Oldest first so lastWeightKg/lastDate land on the most recent set.
  const ordered = [...doneSessions].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  const prs = new Map<string, ExercisePR>()
  for (const session of ordered) {
    for (const se of session.exercises) {
      for (const set of se.sets) {
        if (!set.done) {
          continue
        }
        const cur = prs.get(se.exerciseId) ?? emptyPR(se.exerciseId)
        prs.set(se.exerciseId, foldSet(cur, se.exercise.type, toLoggedSet(set), session.date))
      }
    }
  }
  return prs
}

/**
 * Baseline for one exercise, combining the all-time done-session baselines
 * with the current (in-progress) session's done sets — excluding one set by
 * id so the set under test is compared against everything *else*. Returns
 * undefined when there is no prior data at all (→ detectPr suppresses the
 * trivial first-ever "record"). Because it reads the persisted session, the
 * result survives a reload and a re-log of the same set (max is commutative).
 */
export function baselineExcluding(
  doneBaselines: Record<string, ExercisePR> | undefined,
  session: Session,
  exerciseId: string,
  excludeSetId?: string,
): ExercisePR | undefined {
  const base = doneBaselines?.[exerciseId]
  let pr: ExercisePR | undefined = base ? { ...base } : undefined
  for (const se of session.exercises) {
    if (se.exerciseId !== exerciseId) {
      continue
    }
    for (const set of se.sets) {
      if (!set.done || set.id === excludeSetId) {
        continue
      }
      pr = foldSet(pr ?? emptyPR(exerciseId), se.exercise.type, toLoggedSet(set), session.date)
    }
  }
  return pr
}

/**
 * Does this done set hold a record? True iff it would register as a PR when
 * compared against every other set (all-time + this session). Uses the exact
 * same predicate as the celebration toast, so badge and toast never disagree,
 * and a set that merely ties an existing record is not badged.
 */
export function isRecordSet(
  doneBaselines: Record<string, ExercisePR> | undefined,
  session: Session,
  se: SessionExercise,
  set: SessionExercise['sets'][number],
): boolean {
  if (!set.done) {
    return false
  }
  const baseline = baselineExcluding(doneBaselines, session, se.exerciseId, set.id)
  return detectPr(baseline, se.exercise, toLoggedSet(set)).length > 0
}

/** Ids of every done set in the session that holds a record. */
export function recordSetIds(
  doneBaselines: Record<string, ExercisePR> | undefined,
  session: Session,
): Set<string> {
  const ids = new Set<string>()
  for (const se of session.exercises) {
    for (const set of se.sets) {
      if (isRecordSet(doneBaselines, session, se, set)) {
        ids.add(set.id)
      }
    }
  }
  return ids
}

/** How many records the current session set — for the finish-sheet recap. */
export function sessionPrCount(
  doneBaselines: Record<string, ExercisePR> | undefined,
  session: Session,
): number {
  return recordSetIds(doneBaselines, session).size
}

/**
 * Which records does this just-logged set beat? Empty when there is no
 * baseline yet — a first-ever set is trivially a "PR" and celebrating it
 * would cheapen the real ones.
 */
export function detectPr(
  baseline: ExercisePR | undefined,
  exercise: Exercise,
  set: LoggedSet,
): PrKind[] {
  if (!baseline || baseline.totalDoneSets === 0) {
    return []
  }
  const kinds: PrKind[] = []

  if (exercise.type === 'weighted') {
    const w = set.weightKg
    if (w != null && w > 0) {
      if (baseline.maxWeightKg !== null && w > baseline.maxWeightKg) {
        kinds.push('weight')
      }
      if (baseline.bestEst1Rm !== null && epley(w, set.reps) > baseline.bestEst1Rm) {
        kinds.push('est1rm')
      }
    }
  } else if (exercise.type === 'timed') {
    if (set.seconds != null && baseline.maxSeconds !== null && set.seconds > baseline.maxSeconds) {
      kinds.push('seconds')
    }
  } else if (baseline.maxReps !== null && set.reps > baseline.maxReps) {
    kinds.push('reps')
  }
  return kinds
}

/** Toast copy — leads with the biggest win. */
export function prMessage(kinds: PrKind[], set: LoggedSet): string {
  if (kinds.includes('weight')) {
    return `NEW MAX — ${fmtKg(set.weightKg ?? 0)} KG`
  }
  if (kinds.includes('est1rm') && set.weightKg != null) {
    return `1RM PR — EST ${fmtKg(epley(set.weightKg, set.reps))} KG`
  }
  if (kinds.includes('reps')) {
    return `REP PR — ${set.reps} REPS`
  }
  if (kinds.includes('seconds')) {
    return `TIME PR — ${set.seconds ?? 0}S`
  }
  return 'PERSONAL RECORD'
}
