import { useState } from 'react'
import type { FocusTarget, Location, WorkoutSplit } from '../../../shared/types'
import { st } from '../../lib/stagger'

export type Emphasis =
  | { kind: 'split'; value: WorkoutSplit }
  | { kind: 'focus'; value: FocusTarget }

interface IEmphasisOption {
  label: string
  emphasis: Emphasis
}

/** Splits first, then muscle targets; focus `legs` is covered by the split. */
const EMPHASIS_OPTIONS: IEmphasisOption[] = [
  { label: 'Push', emphasis: { kind: 'split', value: 'push' } },
  { label: 'Pull', emphasis: { kind: 'split', value: 'pull' } },
  { label: 'Legs', emphasis: { kind: 'split', value: 'legs' } },
  { label: 'Chest', emphasis: { kind: 'focus', value: 'chest' } },
  { label: 'Back', emphasis: { kind: 'focus', value: 'back' } },
  { label: 'Shoulders', emphasis: { kind: 'focus', value: 'shoulders' } },
  { label: 'Arms', emphasis: { kind: 'focus', value: 'arms' } },
  { label: 'Core', emphasis: { kind: 'focus', value: 'core' } },
  { label: 'Stamina', emphasis: { kind: 'focus', value: 'stamina' } },
]

interface IPlannerProps {
  secondary: boolean
  minutes: 20 | 45 | 60 | null
  onMinutes: (m: 20 | 45 | 60) => void
  location: Location
  onLocation: (loc: Location) => void
  machinesOnly: boolean
  onMachinesOnly: (on: boolean) => void
  busy: boolean
  error: string | null
  onBuild: (emphasis: Emphasis | null) => void
}

/** The single workout builder: time, location, optional emphasis, one CTA. */
export function Planner({
  secondary,
  minutes,
  onMinutes,
  location,
  onLocation,
  machinesOnly,
  onMachinesOnly,
  busy,
  error,
  onBuild,
}: IPlannerProps) {
  const [pickedLabel, setPickedLabel] = useState<string | null>(null)
  const picked = EMPHASIS_OPTIONS.find((o) => o.label === pickedLabel) ?? null

  const hint = (): string => {
    if (!picked) {
      return 'No emphasis picked — I’ll rotate for you.'
    }
    if (!minutes) {
      return `${picked.label} day — pick a time first.`
    }
    return `${picked.label} day — ${minutes} min at ${location === 'gym' ? 'the gym' : 'home'}.`
  }

  const ctaLabel = (): string => {
    if (busy) {
      return 'Building…'
    }
    if (picked) {
      return `Build ${picked.label.toLowerCase()} day`
    }
    return 'Build my workout'
  }

  return (
    <section className="section stagger-item" style={st(secondary ? 2 : 1)}>
      <div className="section__head">
        <h2 className="type-display-m">
          {secondary ? 'Or train something else' : 'Build today’s session'}
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
      <label className={`planner__machines ${location === 'home' ? 'is-disabled' : ''}`}>
        <input
          type="checkbox"
          checked={machinesOnly}
          disabled={location === 'home'}
          onChange={(e) => onMachinesOnly(e.target.checked)}
        />
        <span>Machines &amp; cables only</span>
      </label>
      <div
        className="chip-scroll planner__emphasis"
        role="group"
        aria-label="Emphasis — optional, tap again to clear"
      >
        {EMPHASIS_OPTIONS.map((opt) => (
          <button
            key={opt.label}
            type="button"
            className="seg__opt chip-scroll__opt"
            aria-pressed={pickedLabel === opt.label}
            onClick={() => setPickedLabel(pickedLabel === opt.label ? null : opt.label)}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <p className="type-caption planner__split-hint">{hint()}</p>
      {error && <p className="form-error">{error}</p>}
      <button
        type="button"
        className={`btn planner__go ${minutes ? 'btn--primary' : 'btn--ghost'}`}
        disabled={!minutes || busy}
        onClick={() => onBuild(picked?.emphasis ?? null)}
      >
        {ctaLabel()}
      </button>
    </section>
  )
}
