import type { Session, SessionExercise } from '../../shared/types'
import {
  SPORT_LABEL,
  fmtDayEyebrow,
  fmtKg,
  fmtSet,
  sessionStats,
  sportClass,
} from '../lib/format'
import { IconCheck } from './icons'
import { Sheet } from './Sheet'

interface WorkoutDetailSheetProps {
  session: Session | null
  onClose: () => void
}

function prescription(se: SessionExercise): string {
  const [lo, hi] = se.targetReps
  const reps = lo === hi ? `${lo}` : `${lo}–${hi}`
  const unit = se.exercise.type === 'timed' ? 'S' : ''
  const weight = se.suggestedWeightKg != null ? ` @ ${fmtKg(se.suggestedWeightKg)}KG` : ''
  return `${se.targetSets} × ${reps}${unit}${weight}`
}

/** Read-only recap of a logged workout, shown from the Log screen. */
export function WorkoutDetailSheet({ session, onClose }: WorkoutDetailSheetProps) {
  if (!session) {
    return (
      <Sheet open={false} onClose={onClose}>
        {null}
      </Sheet>
    )
  }

  return (
    <Sheet
      open={session != null}
      onClose={onClose}
      title={SPORT_LABEL[session.sport]}
      sportClass={sportClass(session.sport)}
    >
      <p className="workout-detail__meta">
        {fmtDayEyebrow(session.date)} · {sessionStats(session)}
      </p>

      {session.exercises.length > 0 ? (
        <div className="list-group" style={{ marginTop: 'var(--space-4)' }}>
          {session.exercises
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((se) => (
              <ExerciseRecap key={se.id} se={se} />
            ))}
        </div>
      ) : null}

      {session.note ? <p className="workout-detail__note">{session.note}</p> : null}
    </Sheet>
  )
}

function ExerciseRecap({ se }: { se: SessionExercise }) {
  const sets = [...se.sets].sort((a, b) => a.setNumber - b.setNumber)
  const done = sets.filter((s) => s.done).length
  const complete = done === sets.length && sets.length > 0

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
          <div key={set.id} className={`set-line ${set.done ? 'is-done' : ''}`}>
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
          </div>
        ))}
      </div>
    </article>
  )
}
