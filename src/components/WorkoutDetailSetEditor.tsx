import { useState } from 'react'
import type { SessionExercise, SetLog } from '../../shared/types'
import { api } from '../lib/api'
import { fmtKg } from '../lib/format'
import { IconCheck } from './icons'
import { Stepper } from './Stepper'

interface SetDraft {
  reps: number
  weight: number
  seconds: number
}

/** Prefill: the set's own values, else the nearest done set (repeat what you did), else the prescription. */
function editDraft(se: SessionExercise, set: SetLog): SetDraft {
  if (set.done) {
    return { reps: set.reps, weight: set.weightKg ?? 0, seconds: set.seconds ?? 20 }
  }
  const doneSets = se.sets.filter((s) => s.done).sort((a, b) => b.setNumber - a.setNumber)
  const nearest = doneSets.find((s) => s.setNumber < set.setNumber) ?? doneSets[0]
  if (nearest) {
    return { reps: nearest.reps, weight: nearest.weightKg ?? 0, seconds: nearest.seconds ?? 20 }
  }
  const midReps = Math.round((se.targetReps[0] + se.targetReps[1]) / 2)
  return {
    reps: midReps,
    weight: se.suggestedWeightKg ?? 0,
    seconds: Math.max(se.targetReps[0], 20),
  }
}

interface WorkoutDetailSetEditorProps {
  se: SessionExercise
  set: SetLog
  sessionId: string
  onSaved: (set: SetLog) => void
}

/** Inline editor for one logged set: adjust reps/weight/seconds, log or un-log it. */
export function WorkoutDetailSetEditor({ se, set, sessionId, onSaved }: WorkoutDetailSetEditorProps) {
  const [draft, setDraft] = useState<SetDraft>(() => editDraft(se, set))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timed = se.exercise.type === 'timed'
  const weighted = se.exercise.type === 'weighted'

  const save = async (done: boolean) => {
    setSaving(true)
    setError(null)
    try {
      const updated = await api.updateSet(sessionId, set.id, {
        reps: timed ? set.reps : draft.reps,
        weightKg: weighted ? draft.weight : null,
        seconds: timed ? draft.seconds : null,
        done,
      })
      onSaved(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the set.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="set-active">
      <p className="type-eyebrow set-active__label">Set {set.setNumber} · edit</p>
      <div className="set-active__steppers">
        {timed ? (
          <Stepper
            value={draft.seconds}
            unit="sec"
            step={5}
            min={5}
            max={600}
            onChange={(seconds) => setDraft({ ...draft, seconds })}
          />
        ) : (
          <>
            <Stepper
              value={draft.reps}
              unit="reps"
              step={1}
              min={0}
              max={100}
              onChange={(reps) => setDraft({ ...draft, reps })}
            />
            {weighted && (
              <Stepper
                value={draft.weight}
                unit="kg"
                step={2.5}
                min={0}
                max={500}
                onChange={(weight) => setDraft({ ...draft, weight })}
                format={fmtKg}
              />
            )}
          </>
        )}
      </div>

      {error && <p className="form-error">{error}</p>}

      <button
        type="button"
        className="btn btn--ghost set-active__log"
        disabled={saving}
        onClick={() => void save(true)}
      >
        <IconCheck size={18} />
        {saving ? 'Saving…' : set.done ? 'Save set' : `Log set ${set.setNumber}`}
      </button>
      {set.done && (
        <button
          type="button"
          className="btn btn--quiet set-active__log"
          disabled={saving}
          onClick={() => void save(false)}
        >
          Mark as not done
        </button>
      )}
    </div>
  )
}
