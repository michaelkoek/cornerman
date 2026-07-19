import { FacetPicker } from './FacetPicker'

/** Search input + labeled searchable facet pickers (body part, equipment). */
export function LibraryFilters({
  query,
  onQuery,
  bodyParts,
  bodyPart,
  onBodyPart,
  equipmentOptions,
  equipment,
  onEquipment,
}: {
  query: string
  onQuery: (q: string) => void
  bodyParts: string[]
  bodyPart: string | null
  onBodyPart: (v: string | null) => void
  equipmentOptions: string[]
  equipment: string | null
  onEquipment: (v: string | null) => void
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
      </div>
    </section>
  )
}
