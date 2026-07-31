import { useState } from 'react'
import type { Muscle } from '../../../shared/types'
import { BodyMap } from '../../components/bodymap/BodyMap'
import { MUSCLE_LABEL } from '../../components/bodymap/regions'

interface IPlannerMuscleMapProps {
  selected: Muscle[]
  onToggle: (muscle: Muscle) => void
  onClear: () => void
}

/**
 * Multi-select body map for the workout builder: tap every muscle the
 * session should touch. Collapsed by default so the planner stays compact.
 */
export function PlannerMuscleMap({ selected, onToggle, onClear }: IPlannerMuscleMapProps) {
  const [open, setOpen] = useState(false)

  const describe = (muscle: Muscle): string => {
    const state = selected.includes(muscle) ? 'selected' : 'not selected'
    return `${MUSCLE_LABEL[muscle]}, ${state}`
  }

  const summary = (): string => {
    if (selected.length === 0) {
      return 'Tap muscles'
    }
    return selected.map((m) => MUSCLE_LABEL[m]).join(' · ')
  }

  return (
    <section className="bodymap-filter" aria-label="Pick target muscles on a body map">
      <button
        type="button"
        className="bodymap-filter__toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="type-eyebrow">Target muscles</span>
        <span className="type-caption">
          {selected.length > 0 ? (
            <span className="bodymap-filter__value">{summary()}</span>
          ) : (
            summary()
          )}
          <span aria-hidden="true"> {open ? '▴' : '▾'}</span>
        </span>
      </button>

      {open && (
        <div className="bodymap-filter__body">
          <div className="bodymap-pair">
            <div>
              <BodyMap
                view="front"
                label="Front view muscle targets"
                selected={selected}
                onToggle={onToggle}
                describe={describe}
              />
              <p className="type-eyebrow bodymap-pair__label">Front</p>
            </div>
            <div>
              <BodyMap
                view="back"
                label="Back view muscle targets"
                selected={selected}
                onToggle={onToggle}
                describe={describe}
              />
              <p className="type-eyebrow bodymap-pair__label">Back</p>
            </div>
          </div>
          {selected.length > 0 && (
            <button type="button" className="btn btn--ghost bodymap-filter__clear" onClick={onClear}>
              Clear selection
            </button>
          )}
        </div>
      )}
    </section>
  )
}
