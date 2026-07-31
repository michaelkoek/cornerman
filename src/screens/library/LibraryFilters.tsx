import type { Muscle } from '../../../shared/types'
import { MUSCLES } from '../../../shared/types'
import { MUSCLE_LABEL } from '../../components/bodymap/regions'
import { FacetPicker } from './FacetPicker'

const LABEL_TO_MUSCLE: Record<string, Muscle> = Object.fromEntries(
  MUSCLES.map((m) => [MUSCLE_LABEL[m], m]),
)

/** Search input + labeled searchable facet pickers (body part, equipment, muscle). */
export function LibraryFilters({
  query,
  onQuery,
  bodyParts,
  bodyPart,
  onBodyPart,
  equipmentOptions,
  equipment,
  onEquipment,
  muscle,
  onMuscle,
}: {
  query: string
  onQuery: (q: string) => void
  bodyParts: string[]
  bodyPart: string | null
  onBodyPart: (v: string | null) => void
  equipmentOptions: string[]
  equipment: string | null
  onEquipment: (v: string | null) => void
  muscle: Muscle | null
  onMuscle: (v: Muscle | null) => void
}) {
  return (
    <section className="library__filters" aria-label="Filter exercises">
      <input
        className="input library__search"
        type="search"
        value={query}
        placeholder="Search exercises…"
        aria-label="Search exercises"
        onChange={(e) => onQuery(e.target.value)}
      />
      <div className="facet-picker__row">
        <FacetPicker label="Body part" options={bodyParts} value={bodyPart} onChange={onBodyPart} />
        <FacetPicker
          label="Equipment"
          options={equipmentOptions}
          value={equipment}
          onChange={onEquipment}
        />
        <FacetPicker
          label="Muscle"
          options={MUSCLES.map((m) => MUSCLE_LABEL[m])}
          value={muscle ? MUSCLE_LABEL[muscle] : null}
          onChange={(v) => onMuscle(v === null ? null : (LABEL_TO_MUSCLE[v] ?? null))}
        />
      </div>
    </section>
  )
}
