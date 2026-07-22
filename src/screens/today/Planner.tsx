import { useState } from 'react'
import type { Location, WorkoutSplit } from '../../../shared/types'
import { st } from '../../lib/stagger'

/** Split planner: time chips + location + optional push/pull/legs override. */
export function Planner({
  secondary,
  minutes,
  onMinutes,
  location,
  onLocation,
  busy,
  error,
  onBuild,
}: {
  secondary: boolean
  minutes: 20 | 45 | 60 | null
  onMinutes: (m: 20 | 45 | 60) => void
  location: Location
  onLocation: (loc: Location) => void
  busy: boolean
  error: string | null
  onBuild: (split: WorkoutSplit | null) => void
}) {
  const [split, setSplit] = useState<WorkoutSplit | null>(null)

  return (
    <section className="section stagger-item" style={st(2)}>
      <div className="section__head">
        <h2 className="type-display-m">
          {secondary ? 'Or train something else' : 'How much time do you have?'}
        </h2>
      </div>
      <div className="chip-row">
        {([20, 45, 60] as const).map((m) => (
          <button
            key={m}
            type="button"
            className="chip"
            aria-pressed={minutes === m}
            onClick={() => onMinutes(m)}
          >
            <span className="chip__value">{m}</span>
            <span className="chip__unit">min</span>
          </button>
        ))}
      </div>
      <div className="seg" role="group" aria-label="Location">
        {(['home', 'gym'] as const).map((loc) => (
          <button
            key={loc}
            type="button"
            className="seg__opt"
            aria-pressed={location === loc}
            onClick={() => onLocation(loc)}
          >
            {loc}
          </button>
        ))}
      </div>
      <div className="seg seg--3" role="group" aria-label="Split — optional, tap again to clear">
        {(['push', 'pull', 'legs'] as const).map((s) => (
          <button
            key={s}
            type="button"
            className="seg__opt"
            aria-pressed={split === s}
            onClick={() => setSplit(split === s ? null : s)}
          >
            {s}
          </button>
        ))}
      </div>
      <p className="type-caption planner__split-hint">
        {split ? `${split.toUpperCase()} day it is.` : 'No split picked — I’ll rotate for you.'}
      </p>
      {error && <p className="form-error">{error}</p>}
      <button
        type="button"
        className={`btn planner__go ${minutes ? 'btn--primary' : 'btn--ghost'}`}
        style={{ width: '100%', height: 'var(--touch-target)' }}
        disabled={!minutes || busy}
        onClick={() => onBuild(split)}
      >
        {busy ? 'Building…' : 'Build my workout'}
      </button>
    </section>
  )
}
