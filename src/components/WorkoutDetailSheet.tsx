import { useEffect, useState } from 'react'
import type { Session, SessionExercise, SetLog } from '../../shared/types'
import {
  SPORT_LABEL,
  fmtDayEyebrow,
  fmtKg,
  fmtSet,
  sessionStats,
  sportClass,
} from '../lib/format'
import { IconCheck } from './icons'
import { RunDetail } from './RunDetail'
import { Sheet } from './Sheet'
import { WorkoutDetailSetEditor } from './WorkoutDetailSetEditor'

interface WorkoutDetailSheetProps {
  session: Session | null
  onClose: () => void
  onEdit: (session: Session) => void
  onDelete: (session: Session) => void
  onChanged: () => void
}

function prescription(se: SessionExercise): string {
  const [lo, hi] = se.targetReps
  const reps = lo === hi ? `${lo}` : `${lo}–${hi}`
  const unit = se.exercise.type === 'timed' ? 'S' : ''
  const weight = se.suggestedWeightKg != null ? ` @ ${fmtKg(se.suggestedWeightKg)}KG` : ''
  return `${se.targetSets} × ${reps}${unit}${weight}`
}

/** Recap of a logged workout, shown from the Log screen. Sets are tap-to-edit. */
export function WorkoutDetailSheet({ session, onClose, onEdit, onDelete, onChanged }: WorkoutDetailSheetProps) {
  // Local copy so set edits render immediately; the list reloads via onChanged.
  const [local, setLocal] = useState<Session | null>(session)

  useEffect(() => {
    setLocal(session)
  }, [session])

  const applySet = (updated: SetLog) => {
    setLocal((prev) => {
      if (!prev) {
        return prev
      }
      return {
        ...prev,
        exercises: prev.exercises.map((se) => ({
          ...se,
          sets: se.sets.map((s) => (s.id === updated.id ? updated : s)),
        })),
      }
    })
    onChanged()
  }

  if (!local) {
    return (
      <Sheet open={false} onClose={onClose}>
        {null}
      </Sheet>
    )
  }

  return (
    <Sheet
      open={local != null}
      onClose={onClose}
      title={SPORT_LABEL[local.sport]}
      sportClass={sportClass(local.sport)}
    >
      <p className="workout-detail__meta">
        {fmtDayEyebrow(local.date)} · {sessionStats(local)}
      </p>

      {local.run != null ? <RunDetail session={local} run={local.run} /> : null}

      {local.exercises.length > 0 ? (
        <div className="list-group" style={{ marginTop: 'var(--space-4)' }}>
          {local.exercises
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((se) => (
              <ExerciseRecap key={se.id} se={se} sessionId={local.id} onSetSaved={applySet} />
            ))}
        </div>
      ) : null}

      {local.note ? <p className="workout-detail__note">{local.note}</p> : null}

      <button type="button" className="btn btn--ghost form-submit" onClick={() => onEdit(local)}>
        Edit session
      </button>
      <button
        type="button"
        className="btn btn--quiet"
        style={{ width: '100%', marginTop: 'var(--space-2)' }}
        onClick={() => onDelete(local)}
      >
        Delete session
      </button>
    </Sheet>
  )
}

function ExerciseRecap({
  se,
  sessionId,
  onSetSaved,
}: {
  se: SessionExercise
  sessionId: string
  onSetSaved: (set: SetLog) => void
}) {
  const [activeSetId, setActiveSetId] = useState<string | null>(null)
  const sets = [...se.sets].sort((a, b) => a.setNumber - b.setNumber)
  const done = sets.filter((s) => s.done).length
  const complete = done === sets.length && sets.length > 0
  const activeSet = sets.find((s) => s.id === activeSetId) ?? null

  return (
    <article className="workout-detail__ex">
      <div className="exercise-row" style={{ minHeight: 'auto' }}>
        <span className="exercise-row__main">
          <span className="exercise-row__name">{se.exercise.name}</span>
          <span className="exercise-row__prescription" style={{ display: 'block' }}>
            {prescription(se)}
          </span>
        </span>
        <span className={`exercise-row__count ${complete ? 'is-complete' : ''}`}>
          {done}/{sets.length}
        </span>
      </div>

      <div className="workout-detail__sets">
        {sets.map((set) => (
          <button
            key={set.id}
            type="button"
            className={`set-line ${set.done ? 'is-done' : ''}`}
            onClick={() => setActiveSetId((cur) => (cur === set.id ? null : set.id))}
          >
            <span className="type-eyebrow">Set {set.setNumber}</span>
            <span className="set-line__vals">
              {set.done ? (
                <>
                  {fmtSet(set, se.exercise.type)}
                  <span className="set-line__check">
                    <IconCheck size={14} />
                  </span>
                </>
              ) : (
                '—'
              )}
            </span>
          </button>
        ))}
      </div>

      {activeSet && (
        <WorkoutDetailSetEditor
          key={activeSet.id}
          se={se}
          set={activeSet}
          sessionId={sessionId}
          onSaved={(updated) => {
            onSetSaved(updated)
            setActiveSetId(null)
          }}
        />
      )}
    </article>
  )
}
