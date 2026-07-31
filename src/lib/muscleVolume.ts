// Weekly training volume per muscle, derived from logged sessions.
// Counting rule: each done set adds 1 to every primary muscle and 0.5 to
// every secondary muscle of its exercise (common set-counting practice —
// compounds contribute without triple-counting).
import type { Muscle, Session } from '../../shared/types'

export type VolumeBucket = 0 | 1 | 2 | 3 | 4

export function setsPerMuscle(
  sessions: Session[],
  from: string,
  to: string,
): Partial<Record<Muscle, number>> {
  const volume: Partial<Record<Muscle, number>> = {}
  const add = (muscle: Muscle, amount: number) => {
    volume[muscle] = (volume[muscle] ?? 0) + amount
  }

  for (const session of sessions) {
    if (session.date < from || session.date > to) {
      continue
    }
    for (const se of session.exercises) {
      const doneSets = se.sets.filter((s) => s.done).length
      if (doneSets === 0) {
        continue
      }
      for (const muscle of se.exercise.primaryMuscles) {
        add(muscle, doneSets)
      }
      for (const muscle of se.exercise.secondaryMuscles) {
        add(muscle, doneSets * 0.5)
      }
    }
  }
  return volume
}

/** Absolute buckets keyed to weekly-volume landmarks: 0, 1–4, 5–9, 10–14, 15+. */
export function volumeBucket(sets: number): VolumeBucket {
  if (sets <= 0) {
    return 0
  }
  if (sets < 5) {
    return 1
  }
  if (sets < 10) {
    return 2
  }
  if (sets < 15) {
    return 3
  }
  return 4
}
