import { useDeferredValue, useMemo, useState } from 'react'
import type { LibraryExercise, Muscle } from '../../../shared/types'
import { Skel } from '../../components/Skeleton'
import { facetValues, filterLibrary, loadLibrary, muscleCounts } from '../../lib/exerciseLibrary'
import { useAsync } from '../../lib/useAsync'
import { BodyMapFilter } from './BodyMapFilter'
import { LibraryDetailSheet } from './LibraryDetailSheet'
import { LibraryFilters } from './LibraryFilters'
import { LibraryList } from './LibraryList'

/** Browsable catalog of all 1,324 dataset exercises (search + facet filters). */
export default function Library() {
  const { data: all, error, loading } = useAsync(loadLibrary)
  const [query, setQuery] = useState('')
  const [bodyPart, setBodyPart] = useState<string | null>(null)
  const [equipment, setEquipment] = useState<string | null>(null)
  const [muscle, setMuscle] = useState<Muscle | null>(null)
  const [selected, setSelected] = useState<LibraryExercise | null>(null)
  const deferredQuery = useDeferredValue(query)

  const facets = useMemo(
    () =>
      all
        ? { bodyParts: facetValues(all, 'bodyPart'), equipment: facetValues(all, 'equipment') }
        : { bodyParts: [], equipment: [] },
    [all],
  )
  const counts = useMemo(() => (all ? muscleCounts(all) : {}), [all])

  const filtered = useMemo(() => {
    if (!all) {
      return []
    }
    return filterLibrary(all, { query: deferredQuery, bodyPart, equipment, muscle })
  }, [all, deferredQuery, bodyPart, equipment, muscle])

  return (
    <main className="screen">
      <header className="screen-title">
        <h1 className="type-display-l">Exercises</h1>
      </header>

      {loading && <Skel h={320} r="var(--radius-m)" />}
      {error && <p className="form-error">Could not load the exercise library. {error}</p>}

      {all && (
        <>
          <LibraryFilters
            query={query}
            onQuery={setQuery}
            bodyParts={facets.bodyParts}
            bodyPart={bodyPart}
            onBodyPart={setBodyPart}
            equipmentOptions={facets.equipment}
            equipment={equipment}
            onEquipment={setEquipment}
            muscle={muscle}
            onMuscle={setMuscle}
          />
          <BodyMapFilter selected={muscle} onSelect={setMuscle} counts={counts} />
          <p className="type-caption library__count" aria-live="polite">
            {filtered.length} of {all.length} exercises
          </p>
          <LibraryList items={filtered} onSelect={setSelected} />
        </>
      )}

      <LibraryDetailSheet exercise={selected} onClose={() => setSelected(null)} />
    </main>
  )
}
