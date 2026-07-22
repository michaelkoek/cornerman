import type { Dispatch, SetStateAction } from 'react'
import type { ExercisePR, SessionExercise, SetLog } from '../../../shared/types'
import { fmtKg, fmtSet } from '../../lib/format'
import { Stepper } from '../../components/Stepper'
import { IconCheck, IconEye, IconSwap } from '../../components/icons'

export interface ISetDraft {
  reps: number
  weight: number
  seconds: number
}

export function draftFor(se: SessionExercise, set: SetLog, best?: ExercisePR): ISetDraft {
  const midReps = Math.round((se.targetReps[0] + se.targetReps[1]) / 2)
  return {
    reps: set.reps > 0 ? set.reps : midReps,
    weight: set.weightKg ?? se.suggestedWeightKg ?? best?.lastWeightKg ?? 0,
    seconds: set.seconds ?? Math.max(se.targetReps[0], 20),
  }
}

function prescription(se: SessionExercise): string {
  const [lo, hi] = se.targetReps
  const reps = lo === hi ? `${lo}` : `${lo}–${hi}`
  const unit = se.exercise.type === 'timed' ? 'S' : ''
  const weight = se.suggestedWeightKg != null ? ` @ ${fmtKg(se.suggestedWeightKg)}KG` : ''
  return `${se.targetSets} × ${reps}${unit}${weight}`
}

interface IExerciseBlockProps {
  se: SessionExercise
  best?: ExercisePR
  recordIds: Set<string>
  expanded: boolean
  onToggle: () => void
  activeSetId: string | null
  onActivateSet: (id: string) => void
  drafts: Record<string, ISetDraft>
  setDrafts: Dispatch<SetStateAction<Record<string, ISetDraft>>>
  popped: boolean
  onLog: (set: SetLog) => void
  onSwap: () => void
  onExample: () => void
}

export function ExerciseBlock({
  se,
  best,
  recordIds,
  expanded,
  onToggle,
  activeSetId,
  onActivateSet,
  drafts,
  setDrafts,
  popped,
  onLog,
  onSwap,
  onExample,
}: IExerciseBlockProps) {
  const sets = [...se.sets].sort((a, b) => a.setNumber - b.setNumber)
  const done = sets.filter((s) => s.done).length
  const complete = done === sets.length && sets.length > 0
  const activeSet =
    (expanded && sets.find((s) => s.id === activeSetId)) || sets.find((s) => !s.done) || null

  return (
    <div>
      <button type="button" className="exercise-row" onClick={onToggle} aria-expanded={expanded}>
        <span className="exercise-row__main">
          <span className="exercise-row__name">{se.exercise.name}</span>
          <span className="exercise-row__prescription" style={{ display: 'block' }}>
            {prescription(se)}
          </span>
        </span>
        <span
          className={`exercise-row__count ${complete ? 'is-complete' : ''} ${popped ? 'pop' : ''}`}
        >
          {done}/{sets.length}
        </span>
      </button>

      {expanded && (
        <div className="exlog">
          <div className="row-between" style={{ alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0 }}>
              <p className="exlog__cue">{se.exercise.cue}</p>
              <div className="exlog__muscles">
                {se.exercise.muscleGroups.map((m) => (
                  <span key={m} className="exlog__muscle">
                    {m}
                  </span>
                ))}
              </div>
            </div>
            <div className="exlog__actions">
              <button type="button" className="exlog__swap" onClick={onExample}>
                <IconEye size={16} />
                Example
              </button>
              <button type="button" className="exlog__swap" onClick={onSwap}>
                <IconSwap size={16} />
                Swap
              </button>
            </div>
          </div>

          <div style={{ marginTop: 'var(--space-3)' }}>
            {sets.map((set) => (
              <button
                key={set.id}
                type="button"
                className={`set-line ${set.done ? 'is-done' : ''}`}
                onClick={() => onActivateSet(set.id)}
              >
                <span className="type-eyebrow">Set {set.setNumber}</span>
                <span className="set-line__vals">
                  {set.done ? (
                    <>
                      {fmtSet(set, se.exercise.type)}{' '}
                      {recordIds.has(set.id) && <span className="set-line__pr">PR</span>}
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
            <SetLogger
              key={activeSet.id}
              se={se}
              set={activeSet}
              draft={drafts[activeSet.id] ?? draftFor(se, activeSet, best)}
              onDraft={(d) => setDrafts((prev) => ({ ...prev, [activeSet.id]: d }))}
              onLog={() => onLog(activeSet)}
            />
          )}
        </div>
      )}
    </div>
  )
}

interface ISetLoggerProps {
  se: SessionExercise
  set: SetLog
  draft: ISetDraft
  onDraft: (d: ISetDraft) => void
  onLog: () => void
}

function SetLogger({ se, set, draft, onDraft, onLog }: ISetLoggerProps) {
  const timed = se.exercise.type === 'timed'
  const weighted = se.exercise.type === 'weighted'

  return (
    <div className="set-active">
      <p className="type-eyebrow set-active__label">
        Set {set.setNumber}
        {set.done ? ' · logged — adjust & re-log' : ''}
      </p>
      <div className="set-active__steppers">
        {timed ? (
          <Stepper
            value={draft.seconds}
            unit="sec"
            step={5}
            min={5}
            max={600}
            onChange={(seconds) => onDraft({ ...draft, seconds })}
          />
        ) : (
          <>
            <Stepper
              value={draft.reps}
              unit="reps"
              step={1}
              min={0}
              max={100}
              onChange={(reps) => onDraft({ ...draft, reps })}
            />
            {weighted && (
              <Stepper
                value={draft.weight}
                unit="kg"
                step={2.5}
                min={0}
                max={500}
                onChange={(weight) => onDraft({ ...draft, weight })}
                format={fmtKg}
              />
            )}
          </>
        )}
      </div>
      <button type="button" className="btn btn--ghost set-active__log" onClick={onLog}>
        <IconCheck size={18} />
        Log set {set.setNumber}
      </button>
    </div>
  )
}
