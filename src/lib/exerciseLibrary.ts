// Lazy access to the bundled exercise library (data/exercise-library.json,
// ~860 KB) — dynamically imported so it only loads inside the /exercises chunk
// or on first instruction-steps open, never on the gym-critical path.
import type { LibraryExercise, Muscle } from '../../shared/types'
import { LIBRARY_TARGET_TO_MUSCLE } from '../../shared/muscles'

let cached: Promise<LibraryExercise[]> | null = null

export function loadLibrary(): Promise<LibraryExercise[]> {
  if (!cached) {
    cached = import('../../data/exercise-library.json').then(
      (mod) => mod.default as LibraryExercise[],
    )
  }
  return cached
}

export async function libraryById(datasetId: string): Promise<LibraryExercise | null> {
  const all = await loadLibrary()
  return all.find((e) => e.id === datasetId) ?? null
}

export interface LibraryFilter {
  query: string
  bodyPart: string | null
  equipment: string | null
  /** Canonical muscle from the body map / muscle picker (primary target only). */
  muscle: Muscle | null
}

/** Canonical primary muscle of a library entry, or null when unmapped. */
export function libraryMuscle(e: LibraryExercise): Muscle | null {
  return LIBRARY_TARGET_TO_MUSCLE[e.target] ?? null
}

export function filterLibrary(
  all: LibraryExercise[],
  { query, bodyPart, equipment, muscle }: LibraryFilter,
): LibraryExercise[] {
  const q = query.trim().toLowerCase()
  return all.filter((e) => {
    if (q && !e.name.toLowerCase().includes(q)) {
      return false
    }
    if (bodyPart && e.bodyPart !== bodyPart) {
      return false
    }
    if (equipment && e.equipment !== equipment) {
      return false
    }
    if (muscle && libraryMuscle(e) !== muscle) {
      return false
    }
    return true
  })
}

/** Exercise count per canonical muscle — feeds the body map's aria labels. */
export function muscleCounts(all: LibraryExercise[]): Partial<Record<Muscle, number>> {
  const counts: Partial<Record<Muscle, number>> = {}
  for (const e of all) {
    const muscle = libraryMuscle(e)
    if (muscle) {
      counts[muscle] = (counts[muscle] ?? 0) + 1
    }
  }
  return counts
}

/** Distinct sorted values of a facet, for filter chips. */
export function facetValues(
  all: LibraryExercise[],
  facet: 'bodyPart' | 'equipment',
): string[] {
  return [...new Set(all.map((e) => e[facet]))].filter((v) => v.length > 0).sort()
}
