import { useState } from 'react'
import type { FocusTarget } from '../../../shared/types'
import { st } from '../../lib/stagger'

const FOCUS_OPTIONS: { value: FocusTarget; label: string }[] = [
  { value: 'chest', label: 'Chest' },
  { value: 'back', label: 'Back' },
  { value: 'shoulders', label: 'Shoulders' },
  { value: 'arms', label: 'Arms' },
  { value: 'legs', label: 'Legs' },
  { value: 'core', label: 'Core' },
  { value: 'stamina', label: 'Stamina' },
]

/** Muscle-focus planner: build a workout around one target using the shared time + location. */
export function FocusPlanner({
  minutes,
  busy,
  onBuild,
}: {
  minutes: 20 | 45 | 60 | null
  busy: boolean
  onBuild: (focus: FocusTarget) => void
}) {
  const [focus, setFocus] = useState<FocusTarget | null>(null)
  const label = FOCUS_OPTIONS.find((o) => o.value === focus)?.label ?? null

  const hint = (): string => {
    if (!focus) {
      return 'Pick a target and I’ll build the session around it.'
    }
    if (!minutes) {
      return `${label} day — pick a time above first.`
    }
    return `${label} day — uses the time and place above.`
  }

  return (
    <section className="section stagger-item" style={st(3)}>
      <div className="section__head">
        <h2 className="type-display-m">Target a muscle</h2>
      </div>
      <div className="chip-scroll" role="group" aria-label="Focus — optional, tap again to clear">
        {FOCUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className="seg__opt chip-scroll__opt"
            aria-pressed={focus === opt.value}
            onClick={() => setFocus(focus === opt.value ? null : opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <p className="type-caption planner__split-hint">{hint()}</p>
      <button
        type="button"
        className={`btn planner__go ${minutes && focus ? 'btn--primary' : 'btn--ghost'}`}
        style={{ width: '100%', height: 'var(--touch-target)' }}
        disabled={!minutes || !focus || busy}
        onClick={() => {
          if (focus) {
            onBuild(focus)
          }
        }}
      >
        {busy ? 'Building…' : focus ? `Build ${label} day` : 'Build a focus day'}
      </button>
    </section>
  )
}
