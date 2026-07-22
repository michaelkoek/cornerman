import { useMemo, useState } from 'react'
import type { Exercise, ExerciseCategory, SessionExercise } from '../../shared/types'
import { api } from '../lib/api'
import { useAsync, usePersist } from '../lib/useAsync'
import { Sheet } from './Sheet'
import { ErrorNotice, Skel } from './Skeleton'

const SPLITS: { value: ExerciseCategory; label: string }[] = [
  { value: 'push', label: 'Push' },
  { value: 'pull', label: 'Pull' },
  { value: 'legs', label: 'Legs' },
]

const CATEGORY_LABEL: Record<ExerciseCategory, string> = {
  push: 'Push',
  pull: 'Pull',
  legs: 'Legs',
  core: 'Core',
  conditioning: 'Conditioning',
}

/** Split chips shown for a swap: push/pull/legs, plus the current category when it falls outside the split. */
function splitOptions(current: ExerciseCategory): { value: ExerciseCategory; label: string }[] {
  if (SPLITS.some((s) => s.value === current)) {
    return SPLITS
  }
  return [{ value: current, label: CATEGORY_LABEL[current] }, ...SPLITS]
}

interface SwapSheetProps {
  swapFor: SessionExercise | null
  sessionId: string
  onClose: () => void
  onSwapped: () => void
}

/** Bottom sheet to replace a session exercise — browse by split, search, or muscle group. */
export function SwapSheet({ swapFor, sessionId, onClose, onSwapped }: SwapSheetProps) {
  const persisted = usePersist(swapFor)
  return (
    <Sheet open={swapFor !== null} onClose={onClose} title="Swap exercise">
      {persisted && (
        <SwapCandidates key={persisted.id} se={persisted} sessionId={sessionId} onSwapped={onSwapped} />
      )}
    </Sheet>
  )
}

function SwapCandidates({
  se,
  sessionId,
  onSwapped,
}: {
  se: SessionExercise
  sessionId: string
  onSwapped: () => void
}) {
  const { data, error, loading, reload } = useAsync(() => api.alternatives(sessionId, se.id))
  const [category, setCategory] = useState<ExerciseCategory>(se.exercise.category)
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [swapError, setSwapError] = useState<string | null>(null)

  const inCategory = useMemo(
    () => (data ?? []).filter((ex) => ex.category === category),
    [data, category],
  )
  const muscles = useMemo(
    () => [...new Set(inCategory.flatMap((ex) => ex.muscleGroups))].sort(),
    [inCategory],
  )
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return inCategory.filter((ex) => {
      if (q && !ex.name.toLowerCase().includes(q)) {
        return false
      }
      if (muscle && !ex.muscleGroups.includes(muscle)) {
        return false
      }
      return true
    })
  }, [inCategory, query, muscle])

  const pickCategory = (next: ExerciseCategory) => {
    setCategory(next)
    setMuscle(null)
  }

  const pick = async (ex: Exercise) => {
    setBusyId(ex.id)
    setSwapError(null)
    try {
      await api.removeSessionExercise(sessionId, se.id)
      await api.addSessionExercise(sessionId, ex.id)
      onSwapped()
    } catch (err) {
      setSwapError(err instanceof Error ? err.message : 'Swap failed.')
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <div className="skel-stack">
        {[0, 1, 2].map((i) => (
          <Skel key={i} h={64} r="var(--radius-m)" />
        ))}
      </div>
    )
  }
  if (error) {
    return <ErrorNotice message={error} onRetry={reload} />
  }
  if (!data || data.length === 0) {
    return <p className="notice__text">No alternatives fit this slot with your equipment.</p>
  }

  return (
    <>
      <p className="type-caption swap-sheet__caption">
        Replacing <strong>{se.exercise.name}</strong>
      </p>
      <section className="swap-sheet__filters" aria-label="Filter alternatives">
        <div className="chip-scroll" role="group" aria-label="Split">
          {splitOptions(se.exercise.category).map((opt) => (
            <button
              key={opt.value}
              type="button"
              className="seg__opt chip-scroll__opt"
              aria-pressed={category === opt.value}
              onClick={() => pickCategory(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <input
          className="input"
          type="search"
          value={query}
          placeholder="Search exercises…"
          aria-label="Search alternatives"
          onChange={(e) => setQuery(e.target.value)}
        />
        {muscles.length > 1 && (
          <div className="chip-scroll" role="group" aria-label="Muscle group — tap again to clear">
            {muscles.map((m) => (
              <button
                key={m}
                type="button"
                className="seg__opt chip-scroll__opt"
                aria-pressed={muscle === m}
                onClick={() => setMuscle(muscle === m ? null : m)}
              >
                {m}
              </button>
            ))}
          </div>
        )}
      </section>
      {visible.length === 0 ? (
        <p className="notice__text">No matches — try another split or clear the filters.</p>
      ) : (
        <div className="list-group">
          {visible.map((ex) => (
            <button
              key={ex.id}
              type="button"
              className="exercise-row"
              disabled={busyId !== null}
              onClick={() => void pick(ex)}
            >
              <span className="exercise-row__main">
                <span className="exercise-row__name">{ex.name}</span>
                <span className="exercise-row__prescription exercise-row__prescription--block">
                  {ex.muscleGroups.join(' · ').toUpperCase()}
                </span>
              </span>
              <span className="exercise-row__count">{busyId === ex.id ? '…' : '→'}</span>
            </button>
          ))}
        </div>
      )}
      {swapError && <p className="form-error">{swapError}</p>}
    </>
  )
}
