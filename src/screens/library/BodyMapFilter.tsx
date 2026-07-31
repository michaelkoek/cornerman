import { useState } from 'react'
import type { Muscle } from '../../../shared/types'
import { BodyMap } from '../../components/bodymap/BodyMap'
import { MUSCLE_LABEL } from '../../components/bodymap/regions'

interface IBodyMapFilterProps {
  selected: Muscle | null
  onSelect: (muscle: Muscle | null) => void
  counts: Partial<Record<Muscle, number>>
}

/**
 * Collapsible tap-a-muscle filter: front + back figures side by side.
 * The "Muscle" facet picker next to the search box drives the same state,
 * so screen-reader and keyboard users have an equivalent list-based path.
 */
export function BodyMapFilter({ selected, onSelect, counts }: IBodyMapFilterProps) {
  const [open, setOpen] = useState(false)

  const describe = (muscle: Muscle): string => {
    const count = counts[muscle] ?? 0
    return `${MUSCLE_LABEL[muscle]}, ${count} exercise${count === 1 ? '' : 's'}`
  }

  const highlighted = selected ? [selected] : []
  const toggle = (muscle: Muscle) => {
    onSelect(selected === muscle ? null : muscle)
  }

  return (
    <section className="bodymap-filter" aria-label="Filter by muscle on a body map">
      <button
        type="button"
        className="bodymap-filter__toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="type-eyebrow">Body map</span>
        <span className="type-caption">
          {selected ? (
            <span className="bodymap-filter__value">{MUSCLE_LABEL[selected]}</span>
          ) : (
            'Tap a muscle'
          )}
          <span aria-hidden="true"> {open ? '▴' : '▾'}</span>
        </span>
      </button>

      {open && (
        <div className="bodymap-filter__body bodymap-pair">
          <div>
            <BodyMap
              view="front"
              label="Front view muscle filter"
              selected={highlighted}
              onToggle={toggle}
              describe={describe}
            />
            <p className="type-eyebrow bodymap-pair__label">Front</p>
          </div>
          <div>
            <BodyMap
              view="back"
              label="Back view muscle filter"
              selected={highlighted}
              onToggle={toggle}
              describe={describe}
            />
            <p className="type-eyebrow bodymap-pair__label">Back</p>
          </div>
        </div>
      )}
    </section>
  )
}
