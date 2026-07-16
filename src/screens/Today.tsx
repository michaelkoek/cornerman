import {
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type SetStateAction,
} from 'react'
import type {
  Anchor,
  Exercise,
  ExercisePR,
  Session,
  SessionExercise,
  SetLog,
  TodayResponse,
} from '../../shared/types'
import { api, type SetPatch } from '../lib/api'
import {
  RECOVERY_HINT,
  SPORT_LABEL,
  fmtDayEyebrow,
  fmtKg,
  fmtSet,
  sportClass,
  workoutTitle,
} from '../lib/format'
import {
  baselineExcluding,
  detectPr,
  prMessage,
  recordSetIds,
  sessionPrCount,
  type LoggedSet,
} from '../lib/prs'
import { useAsync, usePersist } from '../lib/useAsync'
import { PlannerSection } from './today/PlannerSection'
import { ExampleSheet } from '../components/ExampleSheet'
import { ManualLogSheet } from '../components/ManualLogSheet'
import { PrToast } from '../components/PrToast'
import { RestTimer } from '../components/RestTimer'
import { Ring } from '../components/Ring'
import { RpeSlider } from '../components/RpeSlider'
import { Sheet } from '../components/Sheet'
import { Skel, ErrorNotice } from '../components/Skeleton'
import { Stepper } from '../components/Stepper'
import { IconCheck, IconEye, IconSwap } from '../components/icons'

const st = (i: number) => ({ '--i': i }) as CSSProperties

export default function Today() {
  const { data, error, loading, reload, setData } = useAsync(api.today)
  const [restKey, setRestKey] = useState<number | null>(null)

  const setSession = (updater: (prev: Session) => Session) => {
    setData((d) => (d.session ? { ...d, session: updater(d.session) } : d))
  }

  if (loading) return <TodaySkeleton />
  if (error || !data) {
    return (
      <main className="screen">
        <ErrorNotice message={error ?? 'Something went wrong.'} onRetry={reload} />
      </main>
    )
  }

  const session = data.session && data.session.status !== 'skipped' ? data.session : null
  const active = session && session.status !== 'done' ? session : null

  return (
    <main className="screen">
      <TodayHeader data={data} />

      {session?.status === 'done' ? (
        <DoneCard session={session} date={data.date} onSaved={reload} />
      ) : active ? (
        <WorkoutView
          today={data}
          session={active}
          onLocal={setSession}
          reload={reload}
          onRest={() => setRestKey(Date.now())}
        />
      ) : data.anchor ? (
        <>
          <AnchorHero anchor={data.anchor} data={data} onSaved={reload} />
          <CoachHint load={data.yesterdayLoad} />
          <PlannerSection onSession={(s) => setData({ ...data, session: s })} secondary />
        </>
      ) : (
        <>
          <CoachHint load={data.yesterdayLoad} />
          <PlannerSection onSession={(s) => setData({ ...data, session: s })} />
        </>
      )}

      {restKey !== null && <RestTimer key={restKey} onDone={() => setRestKey(null)} />}
    </main>
  )
}

/* ------------------------------------------------------------------ */
/* Header: date, streak, weekly ring                                    */
/* ------------------------------------------------------------------ */

function TodayHeader({ data }: { data: TodayResponse }) {
  return (
    <header className="today-head stagger-item" style={st(0)}>
      <div>
        <p className="type-eyebrow today-head__date">Today · {fmtDayEyebrow(data.date)}</p>
        <h1 className="type-display-l today-head__day">Cornerman</h1>
        <p
          className={`type-eyebrow streak-line ${data.streakWeeks > 0 ? '' : 'is-cold'}`}
        >
          {data.streakWeeks > 0 ? `${data.streakWeeks} wk streak` : 'No streak yet'}
        </p>
      </div>
      <Ring value={data.weekSessions} target={data.weeklyTarget} />
    </header>
  )
}

function CoachHint({ load }: { load: TodayResponse['yesterdayLoad'] }) {
  return (
    <p className="coach-line stagger-item" style={st(1)}>
      {RECOVERY_HINT[load]}
    </p>
  )
}

/* ------------------------------------------------------------------ */
/* Anchor hero + quick log                                              */
/* ------------------------------------------------------------------ */

function AnchorHero({
  anchor,
  data,
  onSaved,
}: {
  anchor: Anchor
  data: TodayResponse
  onSaved: () => void
}) {
  const [open, setOpen] = useState(false)
  const [duration, setDuration] = useState(60)
  const [rpe, setRpe] = useState(7)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const round = Math.min(data.weekSessions + 1, Math.max(data.weeklyTarget, 1))

  const save = async () => {
    setSaving(true)
    setFormError(null)
    try {
      await api.createSession({
        date: data.date,
        sport: anchor.sport,
        durationMin: duration,
        rpe,
        note: note.trim() || undefined,
        status: 'done',
      })
      setOpen(false)
      onSaved()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not log the session.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <section
        className={`card card--hero corner-cut corner-bracket stagger-item ${sportClass(anchor.sport)}`}
        style={st(0)}
      >
        <div className="hero__eyebrow-row">
          <span className="type-eyebrow">Today · {anchor.time}</span>
          <span className="tag">{SPORT_LABEL[anchor.sport]}</span>
        </div>
        <h2 className="type-display-xl hero__name">{anchor.label}</h2>
        <p className="hero__meta">
          {anchor.time} · RD {round}/{data.weeklyTarget} this week
        </p>
        <button type="button" className="btn btn--primary hero__cta" onClick={() => setOpen(true)}>
          Log it
        </button>
      </section>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={anchor.label}
        sportClass={sportClass(anchor.sport)}
      >
        <div className="field">
          <span className="type-eyebrow">Duration · min</span>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Stepper value={duration} unit="min" step={5} min={5} max={240} onChange={setDuration} />
          </div>
        </div>
        <div className="field">
          <span className="type-eyebrow">Effort</span>
          <RpeSlider value={rpe} onChange={setRpe} />
        </div>
        <div className="field">
          <label className="type-eyebrow" htmlFor="anchor-note">
            Note
          </label>
          <textarea
            id="anchor-note"
            className="input"
            placeholder="Rounds, partners, what landed…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        {formError && <p className="form-error">{formError}</p>}
        <button
          type="button"
          className="btn btn--primary form-submit"
          disabled={saving}
          onClick={() => void save()}
        >
          {saving ? 'Saving…' : 'Log session'}
        </button>
      </Sheet>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Workout view: hero + exercise list + set logging + swap + finish     */
/* ------------------------------------------------------------------ */

interface SetDraft {
  reps: number
  weight: number
  seconds: number
}

function draftFor(se: SessionExercise, set: SetLog, best?: ExercisePR): SetDraft {
  const midReps = Math.round((se.targetReps[0] + se.targetReps[1]) / 2)
  return {
    reps: set.reps > 0 ? set.reps : midReps,
    weight: set.weightKg ?? se.suggestedWeightKg ?? best?.lastWeightKg ?? 0,
    seconds: set.seconds ?? Math.max(se.targetReps[0], 20),
  }
}

function WorkoutView({
  today,
  session,
  onLocal,
  reload,
  onRest,
}: {
  today: TodayResponse
  session: Session
  onLocal: (updater: (prev: Session) => Session) => void
  reload: () => void
  onRest: () => void
}) {
  // intentionally computed once — auto-expand shouldn't jump around mid-workout
  const firstIncomplete = useMemo(
    () => session.exercises.find((se) => se.sets.some((s) => !s.done))?.id ?? null,
    [],
  )
  const [expandedId, setExpandedId] = useState<string | null>(firstIncomplete)
  const [activeSetId, setActiveSetId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, SetDraft>>({})
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
    onLocal((s) => ({ ...s, status: 'in_progress' }))
    api.updateSession(session.id, { status: 'in_progress' }).catch(() => reload())
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
    onLocal((s) => ({
      ...s,
      status: s.status === 'planned' ? 'in_progress' : s.status,
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
    api.updateSet(session.id, set.id, patch).catch(() => {
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
      <section
        className={`card card--hero corner-cut corner-bracket stagger-item ${sportClass(session.sport)}`}
        style={st(0)}
      >
        <div className="hero__eyebrow-row">
          <span className="type-eyebrow">Today · {fmtDayEyebrow(today.date)}</span>
          <span className="tag">{session.location ?? SPORT_LABEL[session.sport]}</span>
        </div>
        <h2 className="type-display-xl hero__name">{workoutTitle(session)}</h2>
        <p className="hero__meta">
          {session.durationMin ?? '—'} min · {exercises.length} exercises · RD {round}/
          {today.weeklyTarget} this week
        </p>
        {session.status === 'planned' && (
          <button type="button" className="btn btn--primary hero__cta" onClick={startSession}>
            Start session
          </button>
        )}
      </section>

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

/* ------------------------------------------------------------------ */
/* Discard sheet — reset/stop a session started by mistake             */
/* ------------------------------------------------------------------ */

function DiscardSheet({
  open,
  session,
  onClose,
  onDiscarded,
}: {
  open: boolean
  session: Session
  onClose: () => void
  onDiscarded: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loggedSets = session.exercises.reduce(
    (n, se) => n + se.sets.filter((s) => s.done).length,
    0,
  )

  const body =
    session.status === 'done'
      ? 'This permanently removes the session from your history and stats. It won’t count toward your week.'
      : loggedSets > 0
        ? `This throws away today’s workout and the ${loggedSets} set${loggedSets === 1 ? '' : 's'} you logged. You’ll be back to picking your time.`
        : 'This throws away today’s workout so you can pick a fresh one. Nothing’s been logged yet.'

  const discard = async () => {
    setBusy(true)
    setError(null)
    try {
      await api.deleteSession(session.id)
      onClose()
      onDiscarded()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not discard the session.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Discard workout" sportClass={sportClass(session.sport)}>
      <p className="type-body" style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
        {body}
      </p>
      {error && <p className="form-error">{error}</p>}
      <button
        type="button"
        className="btn btn--danger form-submit"
        disabled={busy}
        onClick={() => void discard()}
      >
        {busy ? 'Discarding…' : 'Discard workout'}
      </button>
      <button
        type="button"
        className="btn btn--ghost"
        style={{ width: '100%', marginTop: 'var(--space-2)' }}
        disabled={busy}
        onClick={onClose}
      >
        Keep going
      </button>
    </Sheet>
  )
}

/* ------------------------------------------------------------------ */
/* Exercise row + expanded set logger                                   */
/* ------------------------------------------------------------------ */

function prescription(se: SessionExercise): string {
  const [lo, hi] = se.targetReps
  const reps = lo === hi ? `${lo}` : `${lo}–${hi}`
  const unit = se.exercise.type === 'timed' ? 'S' : ''
  const weight = se.suggestedWeightKg != null ? ` @ ${fmtKg(se.suggestedWeightKg)}KG` : ''
  return `${se.targetSets} × ${reps}${unit}${weight}`
}

function ExerciseBlock({
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
}: {
  se: SessionExercise
  best?: ExercisePR
  recordIds: Set<string>
  expanded: boolean
  onToggle: () => void
  activeSetId: string | null
  onActivateSet: (id: string) => void
  drafts: Record<string, SetDraft>
  setDrafts: Dispatch<SetStateAction<Record<string, SetDraft>>>
  popped: boolean
  onLog: (set: SetLog) => void
  onSwap: () => void
  onExample: () => void
}) {
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

function SetLogger({
  se,
  set,
  draft,
  onDraft,
  onLog,
}: {
  se: SessionExercise
  set: SetLog
  draft: SetDraft
  onDraft: (d: SetDraft) => void
  onLog: () => void
}) {
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

/* ------------------------------------------------------------------ */
/* Swap sheet                                                           */
/* ------------------------------------------------------------------ */

function SwapSheet({
  swapFor,
  sessionId,
  onClose,
  onSwapped,
}: {
  swapFor: SessionExercise | null
  sessionId: string
  onClose: () => void
  onSwapped: () => void
}) {
  const persisted = usePersist(swapFor)
  return (
    <Sheet open={swapFor !== null} onClose={onClose} title="Swap exercise">
      {persisted && (
        <AlternativesList key={persisted.id} se={persisted} sessionId={sessionId} onSwapped={onSwapped} />
      )}
    </Sheet>
  )
}

function AlternativesList({
  se,
  sessionId,
  onSwapped,
}: {
  se: SessionExercise
  sessionId: string
  onSwapped: () => void
}) {
  const { data, error, loading, reload } = useAsync(() => api.alternatives(sessionId, se.id))
  const [busyId, setBusyId] = useState<string | null>(null)
  const [swapError, setSwapError] = useState<string | null>(null)

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
  if (error) return <ErrorNotice message={error} onRetry={reload} />
  if (!data || data.length === 0) {
    return <p className="notice__text">No alternatives fit this slot with your equipment.</p>
  }

  return (
    <>
      <p className="type-caption" style={{ marginBottom: 'var(--space-3)' }}>
        Replacing <strong>{se.exercise.name}</strong>
      </p>
      <div className="list-group">
        {data.map((ex) => (
          <button
            key={ex.id}
            type="button"
            className="exercise-row"
            disabled={busyId !== null}
            onClick={() => void pick(ex)}
          >
            <span className="exercise-row__main">
              <span className="exercise-row__name">{ex.name}</span>
              <span className="exercise-row__prescription" style={{ display: 'block' }}>
                {ex.muscleGroups.join(' · ').toUpperCase()}
              </span>
            </span>
            <span className="exercise-row__count">{busyId === ex.id ? '…' : '→'}</span>
          </button>
        ))}
      </div>
      {swapError && <p className="form-error">{swapError}</p>}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Finish sheet                                                         */
/* ------------------------------------------------------------------ */

function FinishSheet({
  open,
  session,
  prCount = 0,
  onClose,
  onFinished,
}: {
  open: boolean
  session: Session
  prCount?: number
  onClose: () => void
  onFinished: () => void
}) {
  const [rpe, setRpe] = useState(session.rpe ?? 7)
  const [note, setNote] = useState(session.note ?? '')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const finish = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      await api.updateSession(session.id, {
        status: 'done',
        rpe,
        note: note.trim() || undefined,
      })
      onClose()
      onFinished()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not finish the session.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Finish session" sportClass={sportClass(session.sport)}>
      {prCount > 0 && (
        <p className="coach-line finish-prs">
          {prCount === 1 ? '1 personal record today' : `${prCount} personal records today`} — that’s
          how you get stronger.
        </p>
      )}
      <div className="field">
        <span className="type-eyebrow">How hard was it?</span>
        <RpeSlider value={rpe} onChange={setRpe} />
      </div>
      <div className="field">
        <label className="type-eyebrow" htmlFor="finish-note">
          Note
        </label>
        <textarea
          id="finish-note"
          className="input"
          placeholder="PRs, pain points, what to hit next time…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      {saveError && <p className="form-error">{saveError}</p>}
      <button
        type="button"
        className="btn btn--primary form-submit"
        disabled={saving}
        onClick={() => void finish()}
      >
        {saving ? 'Saving…' : 'Save session'}
      </button>
    </Sheet>
  )
}

/* ------------------------------------------------------------------ */
/* Done card                                                            */
/* ------------------------------------------------------------------ */

function DoneCard({
  session,
  date,
  onSaved,
}: {
  session: Session
  date: string
  onSaved: () => void
}) {
  const [logOpen, setLogOpen] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const bits: string[] = []
  if (session.durationMin != null) bits.push(`${session.durationMin} MIN`)
  if (session.rpe != null) bits.push(`RPE ${session.rpe}`)
  if (session.distanceKm != null) bits.push(`${session.distanceKm.toFixed(1)} KM`)
  if (session.exercises.length > 0) bits.push(`${session.exercises.length} EXERCISES`)

  return (
    <>
      <section
        className={`card card--hero corner-cut corner-bracket stagger-item ${sportClass(session.sport)}`}
        style={st(0)}
      >
        <div className="hero__eyebrow-row">
          <span className="type-eyebrow" style={{ color: 'var(--positive)' }}>
            Session done · {fmtDayEyebrow(date)}
          </span>
          <span className="tag">{SPORT_LABEL[session.sport]}</span>
        </div>
        <h2 className="type-display-xl hero__name">{workoutTitle(session)}</h2>
        <p className="hero__meta">{bits.join(' · ') || 'Logged'}</p>
        <p className="coach-line">That’s a wrap. Hands down, chin up.</p>
        <button
          type="button"
          className="btn btn--ghost hero__cta"
          style={{ width: '100%' }}
          onClick={() => setLogOpen(true)}
        >
          Log another session
        </button>
        <button
          type="button"
          className="btn btn--quiet"
          style={{ width: '100%', marginTop: 'var(--space-2)' }}
          onClick={() => setDiscardOpen(true)}
        >
          Logged by mistake? Discard
        </button>
      </section>

      <ManualLogSheet open={logOpen} onClose={() => setLogOpen(false)} onSaved={onSaved} />
      <DiscardSheet
        open={discardOpen}
        session={session}
        onClose={() => setDiscardOpen(false)}
        onDiscarded={onSaved}
      />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Loading skeleton                                                     */
/* ------------------------------------------------------------------ */

function TodaySkeleton() {
  return (
    <main className="screen" aria-busy="true">
      <div className="today-head">
        <div style={{ flex: 1 }}>
          <Skel h={12} w={140} />
          <Skel h={32} w={200} style={{ marginTop: 8 }} />
          <Skel h={12} w={110} style={{ marginTop: 12 }} />
        </div>
        <Skel h={64} w={64} r="var(--radius-full)" />
      </div>
      <Skel h={220} r="var(--radius-l)" />
      <div className="skel-stack" style={{ marginTop: 'var(--space-6)' }}>
        <Skel h={64} r="var(--radius-m)" />
        <Skel h={64} r="var(--radius-m)" />
        <Skel h={64} r="var(--radius-m)" />
      </div>
    </main>
  )
}
