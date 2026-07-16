/** Search input + horizontally scrollable facet chip rows (body part, equipment). */
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
      <FacetRow label="Body part" options={bodyParts} value={bodyPart} onChange={onBodyPart} />
      <FacetRow
        label="Equipment"
        options={equipmentOptions}
        value={equipment}
        onChange={onEquipment}
      />
    </section>
  )
}

function FacetRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: string[]
  value: string | null
  onChange: (v: string | null) => void
}) {
  return (
    <div className="chip-scroll" role="group" aria-label={`${label} — tap again to clear`}>
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          className="seg__opt chip-scroll__opt"
          aria-pressed={value === opt}
          onClick={() => onChange(value === opt ? null : opt)}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}
