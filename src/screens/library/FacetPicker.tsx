import { useState } from 'react'
import { Sheet } from '../../components/Sheet'

interface IFacetPickerProps {
  label: string
  options: string[]
  value: string | null
  onChange: (v: string | null) => void
}

/**
 * Single-select facet filter as a labeled trigger + searchable bottom-sheet
 * picker. The trigger doubles as the active-filter overview: it shows the
 * selected value and takes the gold accent treatment while a filter is on.
 */
export function FacetPicker({ label, options, value, onChange }: IFacetPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const close = () => {
    setOpen(false)
    setSearch('')
  }

  const pick = (v: string | null) => {
    onChange(v)
    close()
  }

  const needle = search.trim().toLowerCase()
  const visible = needle ? options.filter((opt) => opt.toLowerCase().includes(needle)) : options

  return (
    <>
      <button
        type="button"
        className="facet-picker__trigger"
        aria-pressed={value !== null}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span className="facet-picker__label">{label}</span>
        <span className="facet-picker__value">{value ?? 'All'}</span>
        <span className="facet-picker__chevron" aria-hidden="true">
          ▾
        </span>
      </button>

      <Sheet open={open} onClose={close} title={label}>
        <input
          className="input facet-picker__search"
          type="search"
          value={search}
          placeholder={`Search ${label.toLowerCase()}…`}
          aria-label={`Search ${label.toLowerCase()}`}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="facet-picker__options" role="radiogroup" aria-label={label}>
          <button
            type="button"
            role="radio"
            className="facet-picker__option"
            aria-checked={value === null}
            onClick={() => pick(null)}
          >
            All
          </button>
          {visible.map((opt) => (
            <button
              key={opt}
              type="button"
              role="radio"
              className="facet-picker__option"
              aria-checked={value === opt}
              onClick={() => pick(opt)}
            >
              {opt}
            </button>
          ))}
          {visible.length === 0 && (
            <p className="type-caption facet-picker__empty">No matches for “{search.trim()}”.</p>
          )}
        </div>
      </Sheet>
    </>
  )
}
