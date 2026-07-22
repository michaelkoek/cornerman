import { useMemo, useRef, useState } from 'react'
import type { Exercise, Session, SessionExercise, SetLog, TodayResponse } from '../../../shared/types'
import { api, type SetPatch } from '../../lib/api'
import { baselineExcluding, detectPr, prMessage, recordSetIds, sessionPrCount, type LoggedSet } from '../../lib/prs'
import { st } from '../../lib/stagger'
import { pauseTimerPatch, resumeTimerPatch, startTimerPatch } from '../../lib/workoutTimer'
import { ExampleSheet } from '../../components/ExampleSheet'
import { PrToast } from '../../components/PrToast'
import { SwapSheet } from '../../components/SwapSheet'
import { WorkoutTimerStrip } from '../../components/WorkoutTimerStrip'
import { CoachHint } from './CoachHint'
import { DiscardSheet } from '../../components/DiscardSheet'
import { ExerciseBlock, draftFor, type ISetDraft } from './ExerciseBlock'
import { FinishSheet } from './FinishSheet'
import { WorkoutHero } from './WorkoutHero'

interface IWorkoutViewProps {
  today: TodayResponse
  session: Session
  onLocal: (updater: (prev: Session) => Session) => void
  reload: () => void
  onRest: () => void
  onRestCancel: () => void
}

export function WorkoutView({ today, session, onLocal, reload, onRest, onRestCancel }: IWorkoutViewProps) {
  // intentionally computed once — auto-expand shouldn't jump around mid-workout
  const firstIncomplete = useMemo(
    () => session.exercises.find((se) => se.sets.some((s) => !s.done))?.id ?? null,
    [],
  )
  const [expandedId, setExpandedId] = useState<string | null>(firstIncomplete)
  const [activeSetId, setActiveSetId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, ISetDraft>>({})
  const [poppedExId, setPoppedExId] = useState<string | null>(null)
  const [swapFor, setSwapFor] = useState<SessionExercise | null>(null)
  const [exampleFor, setExampleFor] = useState<Exercise | null>(null)
  const [finishOpen, setFinishOpen] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [prToast, setPrToast] = useState<{ msg: string; key: number } | null>(null)
  const toastSeq = useRef(0)

  // Records are derived from the persisted session (+ all-time baselines), not
  // stored — so a mid-workout reload or a re-log can't lose or double a PR.
  const records = useMemo(
    () => recordSetIds(today.prBaselines, session),
    [today.prBaselines, session],
  )

  const exercises = [...session.exercises].sort((a, b) => a.order - b.order)
  const totalSets = exercises.reduce((n, se) => n + se.sets.length, 0)
  const doneSets = exercises.reduce((n, se) => n + se.sets.filter((s) => s.done).length, 0)
  const allDone = totalSets > 0 && doneSets === totalSets
  const round = Math.min(today.weekSessions + 1, Math.max(today.weeklyTarget, 1))

  const startSession = () => {
    const now = Date.now()
    onLocal((s) => ({ ...s, status: 'in_progress', startedAt: now }))
    api.updateSession(session.id, startTimerPatch(now)).catch(() => reload())
  }

  const pauseTimer = () => {
    const patch = pauseTimerPatch(session, Date.now())
    onLocal((s) => ({ ...s, startedAt: null, elapsedSec: patch.elapsedSec ?? s.elapsedSec }))
    api.updateSession(session.id, patch).catch(() => reload())
    onRestCancel()
  }

  const resumeTimer = () => {
    const now = Date.now()
    onLocal((s) => ({ ...s, startedAt: now }))
    api.updateSession(session.id, resumeTimerPatch(now)).catch(() => reload())
  }

  const logSet = (se: SessionExercise, set: SetLog) => {
    const d = drafts[set.id] ?? draftFor(se, set, today.prBaselines?.[se.exerciseId])
    const timed = se.exercise.type === 'timed'
    const weighted = se.exercise.type === 'weighted'
    const patch: SetPatch = timed
      ? { seconds: d.seconds, done: true }
      : { reps: d.reps, weightKg: weighted ? d.weight : null, done: true }

    // PR check: compare this set against every OTHER set (all-time baselines +
    // this session's done sets, excluding this one). Reload- and re-log-proof
    // because it reads the persisted session, keeps no ratcheting state.
    const logged: LoggedSet = {
      reps: d.reps,
      weightKg: weighted ? d.weight : null,
      seconds: timed ? d.seconds : null,
    }
    const baseline = baselineExcluding(today.prBaselines, session, se.exerciseId, set.id)
    const prKinds = detectPr(baseline, se.exercise, logged)
    if (prKinds.length > 0) {
      toastSeq.current += 1
      setPrToast({ msg: prMessage(prKinds, logged), key: toastSeq.current })
      navigator.vibrate?.([40, 60, 120])
    }

    // Carry what was just lifted into the next undone set of this exercise.
    const nextSet = [...se.sets]
      .sort((a, b) => a.setNumber - b.setNumber)
      .find((x) => !x.done && x.setNumber > set.setNumber)
    if (nextSet) {
      setDrafts((prev) => (prev[nextSet.id] ? prev : { ...prev, [nextSet.id]: d }))
    }

    // optimistic — gym use has to feel instant
    const now = Date.now()
    const autoStart = session.status === 'planned'
    onLocal((s) => ({
      ...s,
      status: s.status === 'planned' ? 'in_progress' : s.status,
      startedAt: s.status === 'planned' ? now : s.startedAt,
      exercises: s.exercises.map((ex) =>
        ex.id !== se.id
          ? ex
          : {
              ...ex,
              sets: ex.sets.map((x) => (x.id === set.id ? { ...x, ...patch, done: true } : x)),
            },
      ),
    }))
    setActiveSetId(null)
    setPoppedExId(se.id)
    window.setTimeout(() => setPoppedExId((v) => (v === se.id ? null : v)), 300)
    setActionError(null)
    // Chained on auto-start: updateSet is a read-modify-write of the whole
    // session doc, so a concurrent status patch would be clobbered.
    const persist = autoStart
      ? api.updateSession(session.id, startTimerPatch(now)).then(() => api.updateSet(session.id, set.id, patch))
      : api.updateSet(session.id, set.id, patch)
    persist.catch(() => {
      setActionError('That set didn’t save — check the connection.')
      reload()
    })

    const remaining = totalSets - doneSets - (set.done ? 0 : 1)
    if (remaining > 0) {
      onRest()
    } else {
      setFinishOpen(true)
    }
  }

  return (
    <>
      {session.status === 'in_progress' && (
        <WorkoutTimerStrip
          session={session}
          onPause={pauseTimer}
          onResume={resumeTimer}
          onFinish={() => setFinishOpen(true)}
        />
      )}

      <WorkoutHero
        today={today}
        session={session}
        round={round}
        exerciseCount={exercises.length}
        onStart={startSession}
      />

      <CoachHint load={today.yesterdayLoad} />

      <section className="section stagger-item" style={st(2)}>
        <div className="section__head">
          <h3 className="type-display-m">The work</h3>
          <span className="week-head__count">
            {doneSets}/{totalSets} sets
          </span>
        </div>
        <div className="list-group">
          {exercises.map((se) => (
            <ExerciseBlock
              key={se.id}
              se={se}
              best={today.prBaselines?.[se.exerciseId]}
              recordIds={records}
              expanded={expandedId === se.id}
              onToggle={() => setExpandedId(expandedId === se.id ? null : se.id)}
              activeSetId={activeSetId}
              onActivateSet={setActiveSetId}
              drafts={drafts}
              setDrafts={setDrafts}
              popped={poppedExId === se.id}
              onLog={(set) => logSet(se, set)}
              onSwap={() => setSwapFor(se)}
              onExample={() => setExampleFor(se.exercise)}
            />
          ))}
        </div>
        {actionError && <p className="form-error">{actionError}</p>}
        <button
          type="button"
          className={`btn workout-finish ${allDone ? 'btn--primary' : 'btn--ghost'}`}
          style={{ width: '100%', height: 'var(--touch-target)' }}
          onClick={() => setFinishOpen(true)}
        >
          Finish session
        </button>
        <button
          type="button"
          className="btn btn--quiet workout-discard"
          style={{ width: '100%', marginTop: 'var(--space-2)' }}
          onClick={() => setDiscardOpen(true)}
        >
          Discard workout
        </button>
      </section>

      <ExampleSheet exercise={exampleFor} onClose={() => setExampleFor(null)} />

      <SwapSheet
        swapFor={swapFor}
        sessionId={session.id}
        onClose={() => setSwapFor(null)}
        onSwapped={() => {
          setSwapFor(null)
          reload()
        }}
      />

      <FinishSheet
        open={finishOpen}
        session={session}
        prCount={sessionPrCount(today.prBaselines, session)}
        onClose={() => setFinishOpen(false)}
        onFinished={reload}
      />

      <DiscardSheet
        open={discardOpen}
        session={session}
        onClose={() => setDiscardOpen(false)}
        onDiscarded={reload}
      />

      {prToast && (
        <PrToast key={prToast.key} message={prToast.msg} onDone={() => setPrToast(null)} />
      )}
    </>
  )
}
