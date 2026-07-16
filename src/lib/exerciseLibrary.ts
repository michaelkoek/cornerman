// Lazy access to the bundled exercise library (data/exercise-library.json,
// ~860 KB) — dynamically imported so it only loads inside the /exercises chunk
// or on first instruction-steps open, never on the gym-critical path.
import type { LibraryExercise } from '../../shared/types'

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
}

export function filterLibrary(
  all: LibraryExercise[],
  { query, bodyPart, equipment }: LibraryFilter,
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
    return true
  })
}

/** Distinct sorted values of a facet, for filter chips. */
export function facetValues(
  all: LibraryExercise[],
  facet: 'bodyPart' | 'equipment',
): string[] {
  return [...new Set(all.map((e) => e[facet]))].filter((v) => v.length > 0).sort()
}
