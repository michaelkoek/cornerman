import { useMemo, useState, type FormEvent } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'
import type {
  BodyweightResponse,
  DashboardResponse,
  Exercise,
  ExerciseHistoryResponse,
  ExercisePR,
  Sport,
} from '../../shared/types'
import { api } from '../lib/api'
import { addDays } from '../lib/db'
import {
  SPORTS,
  SPORT_HEX,
  SPORT_LABEL,
  fmtKg,
  fmtSetCompact,
  fmtShortDate,
  parseIso,
  todayIso,
} from '../lib/format'
import { useAsync, usePersist } from '../lib/useAsync'
import { PullToRefresh } from '../components/PullToRefresh'
import { usePinchZoom } from '../lib/usePinchZoom'
import { EmptyNotice, ErrorNotice, Skel } from '../components/Skeleton'
import { Sheet } from '../components/Sheet'

/* Ringside scoreboard chart styling — no recharts defaults (DESIGN.md §5.6). */
const TICK = {
  fill: 'rgba(244, 238, 228, 0.42)',
  fontSize: 11,
  fontFamily: "'Spline Sans Mono', ui-monospace, monospace",
}
const GRID = 'rgba(244, 238, 228, 0.08)'
const EMPTY_COPY = 'Nothing logged yet. First bell rings when you do.'

export default function Progress() {
  const { data, error, loading, refreshing, reload } = useAsync(api.dashboard)
  const [detailId, setDetailId] = useState<string | null>(null)

  if (loading) return <ProgressSkeleton />
  if (error || !data) {
    return (
      <main className="screen">
        <header className="screen-title">
          <h1 className="type-display-l">Progress</h1>
        </header>
        <ErrorNotice message={error ?? 'Something went wrong.'} onRetry={reload} />
      </main>
    )
  }

  return (
    <main className="screen">
      <PullToRefresh onRefresh={reload} refreshing={refreshing} />
      <header className="screen-title">
        <h1 className="type-display-l">Progress</h1>
      </header>

      <div className="stat-row">
        <div className="stat-block">
          <p className="stat-block__value">
            {data.streakWeeks}
            <em>WK</em>
          </p>
          <p className="type-eyebrow stat-block__label">Streak</p>
        </div>
        <div className="stat-block">
          <p className="stat-block__value">{data.sessionsThisMonth}</p>
          <p className="type-eyebrow stat-block__label">Sessions this month</p>
        </div>
      </div>

      <section className="section">
        <div className="section__head">
          <h2 className="type-display-m">Weekly volume</h2>
          <span className="section__sub">min · 12 wks</span>
        </div>
        <VolumeChart data={data} />
      </section>

      <section className="section">
        <div className="section__head">
          <h2 className="type-display-m">Lift progression</h2>
          <span className="section__sub">est. 1RM</span>
        </div>
        {data.liftProgression.length === 0 ? (
          <EmptyNotice text={EMPTY_COPY} />
        ) : (
          <div className="lift-grid">
            {data.liftProgression.slice(0, 6).map((lift) => (
              <LiftCard key={lift.exerciseId} lift={lift} onOpen={() => setDetailId(lift.exerciseId)} />
            ))}
          </div>
        )}
      </section>

      {(data.allLifts?.length ?? 0) > 6 && (
        <section className="section">
          <div className="section__head">
            <h2 className="type-display-m">All lifts</h2>
            <span className="section__sub">all-time max</span>
          </div>
          <div className="list-group">
            {data.allLifts?.slice(6).map((lift) => (
              <button
                key={lift.exerciseId}
                type="button"
                className="exercise-row"
                onClick={() => setDetailId(lift.exerciseId)}
              >
                <span className="exercise-row__main">
                  <span className="exercise-row__name">{lift.name}</span>
                  <span className="exercise-row__prescription" style={{ display: 'block' }}>
                    {lift.maxWeightKg != null ? `MAX ${fmtKg(lift.maxWeightKg)}KG` : '—'}
                    {lift.bestEst1Rm != null ? ` · 1RM ${fmtKg(lift.bestEst1Rm)}KG` : ''}
                  </span>
                </span>
                <span className="exercise-row__count">{fmtShortDate(lift.lastDate)}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <div className="section__head">
          <h2 className="type-display-m">Bodyweight</h2>
          <span className="section__sub">kg · 12 wks</span>
        </div>
        <WeightSection />
      </section>

      <ExerciseDetailSheet exerciseId={detailId} onClose={() => setDetailId(null)} />
    </main>
  )
}

/* ------------------------------------------------------------------ */
/* Weekly volume — stacked bars, sport-coded, current week at 100%      */
/* ------------------------------------------------------------------ */

type VolumeRow = { weekStart: string } & Partial<Record<Sport, number>>

function VolumeChart({ data }: { data: DashboardResponse }) {
  const { rows, sports } = useMemo(() => {
    const present = SPORTS.filter((sport) =>
      data.weeklyVolume.some((w) => (w.bySport[sport] ?? 0) > 0),
    )
    const mapped: VolumeRow[] = data.weeklyVolume.map((w) => ({
      weekStart: w.weekStart,
      ...w.bySport,
    }))
    return { rows: mapped, sports: present }
  }, [data])

  const hasVolume = sports.length > 0
  const zoomRef = usePinchZoom<HTMLDivElement>()

  if (!hasVolume) return <EmptyNotice text={EMPTY_COPY} />

  return (
    <>
      <div className="chart-plot">
        <div ref={zoomRef} className="chart-plot__zoom">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={rows} barSize={8} margin={{ top: 8, right: 4, bottom: 0, left: -16 }}>
              <CartesianGrid vertical={false} stroke={GRID} strokeWidth={1} />
              <XAxis
                dataKey="weekStart"
                axisLine={false}
                tickLine={false}
                tick={TICK}
                interval={2}
                tickFormatter={shortWeek}
              />
              <YAxis axisLine={false} tickLine={false} tick={TICK} tickCount={4} allowDecimals={false} />
              {sports.map((sport, si) => (
                <Bar
                  key={sport}
                  dataKey={sport}
                  stackId="volume"
                  fill={SPORT_HEX[sport]}
                  radius={si === sports.length - 1 ? [3, 3, 0, 0] : 0}
                  animationDuration={600}
                  animationBegin={si * 40}
                >
                  {rows.map((r, i) => (
                    <Cell key={r.weekStart} fillOpacity={i === rows.length - 1 ? 1 : 0.4} />
                  ))}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="chart-key">
        {sports.map((sport) => (
          <span key={sport} className="chart-key__item" style={{ color: SPORT_HEX[sport] }}>
            <span className="chart-key__swatch" />
            <span style={{ color: 'var(--text-tertiary)' }}>{SPORT_LABEL[sport]}</span>
          </span>
        ))}
      </div>
    </>
  )
}

function shortWeek(iso: string): string {
  const d = parseIso(iso)
  return `${d.getDate()}/${d.getMonth() + 1}`
}

/* ------------------------------------------------------------------ */
/* Lift progression small multiples                                     */
/* ------------------------------------------------------------------ */

const LIFT_HEX = SPORT_HEX.weightlifting

function LiftCard({
  lift,
  onOpen,
}: {
  lift: DashboardResponse['liftProgression'][number]
  onOpen: () => void
}) {
  const points = lift.points
  const last = points[points.length - 1]
  const first = points[0]
  const delta = last && first ? last.est1Rm - first.est1Rm : 0

  return (
    <button type="button" className="lift-card" onClick={onOpen}>
      <p className="lift-card__name" title={lift.name}>
        {lift.name}
      </p>
      <div className="lift-card__vals">
        <span className="lift-card__current">{last ? `${fmtKg(last.est1Rm)}kg` : '—'}</span>
        {points.length > 1 && (
          <span className={`lift-card__delta ${delta > 0 ? 'is-up' : delta < 0 ? 'is-down' : ''}`}>
            {delta >= 0 ? '+' : ''}
            {fmtKg(delta)}
          </span>
        )}
      </div>
      {lift.pr?.maxWeightKg != null && (
        <p className="lift-card__pr">
          MAX {fmtKg(lift.pr.maxWeightKg)}KG
          {lift.pr.maxWeightReps != null ? ` × ${lift.pr.maxWeightReps}` : ''}
        </p>
      )}
      <ResponsiveContainer width="100%" height={84}>
        <LineChart data={points} margin={{ top: 8, right: 10, bottom: 4, left: 10 }}>
          <XAxis dataKey="date" hide />
          <YAxis hide domain={['dataMin - 2', 'dataMax + 2']} />
          <Line
            type="monotone"
            dataKey="est1Rm"
            stroke={LIFT_HEX}
            strokeWidth={2}
            dot={false}
            activeDot={false}
            animationDuration={600}
          />
          {last && <ReferenceDot x={last.date} y={last.est1Rm} r={4} fill={LIFT_HEX} stroke="none" />}
        </LineChart>
      </ResponsiveContainer>
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Per-exercise detail sheet — full history, records, recent sets       */
/* ------------------------------------------------------------------ */

const PR_HEX = '#E0A33C'

function ExerciseDetailSheet({
  exerciseId,
  onClose,
}: {
  exerciseId: string | null
  onClose: () => void
}) {
  const persisted = usePersist(exerciseId)
  return (
    <Sheet open={exerciseId !== null} onClose={onClose} title="History">
      {persisted && <ExerciseDetail key={persisted} exerciseId={persisted} />}
    </Sheet>
  )
}

function ExerciseDetail({ exerciseId }: { exerciseId: string }) {
  const { data, error, loading, reload } = useAsync(() => api.exerciseHistory(exerciseId))

  if (loading) {
    return (
      <div className="skel-stack">
        <Skel h={96} r="var(--radius-m)" />
        <Skel h={200} r="var(--radius-m)" />
      </div>
    )
  }
  if (error || !data) {
    return <ErrorNotice message={error ?? 'Something went wrong.'} onRetry={reload} />
  }
  // Body is a separate component so it mounts only once data exists — that way
  // usePinchZoom's effect runs when the chart ref is set, not on the skeleton.
  return <ExerciseDetailBody data={data} />
}

type RecentSet = ExerciseHistoryResponse['recent'][number]['sets'][number]

/** Does this set hold the record for display purposes (equality with the max)? */
function holdsRecord(set: RecentSet, type: Exercise['type'], pr: ExercisePR): boolean {
  if (type === 'timed') {
    return set.seconds != null && set.seconds === pr.maxSeconds
  }
  if (type === 'weighted') {
    return set.weightKg != null && set.weightKg > 0 && set.weightKg === pr.maxWeightKg
  }
  return set.reps > 0 && set.reps === pr.maxReps
}

function ExerciseDetailBody({ data }: { data: ExerciseHistoryResponse }) {
  const zoomRef = usePinchZoom<HTMLDivElement>()

  const { exercise, pr, points, recent } = data
  const weighted = exercise.type === 'weighted'
  const first = points[0]
  const last = points[points.length - 1]
  const delta = first && last ? last.topSetKg - first.topSetKg : 0
  const maxPoint = points.reduce<ExerciseHistoryResponse['points'][number] | null>(
    (best, p) => (best === null || p.topSetKg > best.topSetKg ? p : best),
    null,
  )

  return (
    <>
      <p className="type-caption" style={{ marginBottom: 'var(--space-3)' }}>
        <strong>{exercise.name}</strong> · {exercise.muscleGroups.join(' · ').toUpperCase()}
      </p>

      {weighted ? (
        <>
          <div className="stat-row">
            <div className="stat-block">
              <p className="stat-block__value">
                {pr.maxWeightKg != null ? fmtKg(pr.maxWeightKg) : '—'}
                <em>KG</em>
              </p>
              <p className="type-eyebrow stat-block__label">
                Max weight{pr.maxWeightReps != null ? ` × ${pr.maxWeightReps}` : ''}
              </p>
            </div>
            <div className="stat-block">
              <p className="stat-block__value">
                {pr.bestEst1Rm != null ? fmtKg(pr.bestEst1Rm) : '—'}
                <em>KG</em>
              </p>
              <p className="type-eyebrow stat-block__label">Best est. 1RM</p>
            </div>
          </div>
          <div className="stat-row" style={{ borderTop: 'none' }}>
            <div className="stat-block">
              <p className="stat-block__value">
                {pr.maxReps ?? '—'}
                <em>REPS</em>
              </p>
              <p className="type-eyebrow stat-block__label">Max reps in a set</p>
            </div>
            <div className="stat-block">
              <p className="stat-block__value">
                {pr.totalDoneSets}
                <em>SETS</em>
              </p>
              <p className="type-eyebrow stat-block__label">Sets logged</p>
            </div>
          </div>
        </>
      ) : (
        <div className="stat-row">
          <div className="stat-block">
            <p className="stat-block__value">
              {exercise.type === 'timed' ? (pr.maxSeconds ?? '—') : (pr.maxReps ?? '—')}
              <em>{exercise.type === 'timed' ? 'S' : 'REPS'}</em>
            </p>
            <p className="type-eyebrow stat-block__label">
              {exercise.type === 'timed' ? 'Longest set' : 'Max reps'}
            </p>
          </div>
          <div className="stat-block">
            <p className="stat-block__value">
              {pr.totalDoneSets}
              <em>SETS</em>
            </p>
            <p className="type-eyebrow stat-block__label">Sets logged</p>
          </div>
        </div>
      )}

      {points.length > 1 && (
        <section className="section" style={{ marginTop: 'var(--space-5)' }}>
          <div className="section__head">
            <h3 className="type-display-m">Top set</h3>
            {first && delta !== 0 && (
              <span className={`lift-card__delta ${delta > 0 ? 'is-up' : 'is-down'}`}>
                {delta > 0 ? '+' : ''}
                {fmtKg(delta)}KG since {fmtShortDate(first.date)}
              </span>
            )}
          </div>
          <div className="chart-plot">
            <div ref={zoomRef} className="chart-plot__zoom">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={points} margin={{ top: 12, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid vertical={false} stroke={GRID} strokeWidth={1} />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={TICK}
                    interval={Math.max(0, Math.ceil(points.length / 4) - 1)}
                    tickFormatter={shortWeek}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={TICK}
                    tickCount={4}
                    domain={['dataMin - 2', 'dataMax + 2']}
                    tickFormatter={fmtKg}
                  />
                  <Line
                    type="monotone"
                    dataKey="topSetKg"
                    stroke={LIFT_HEX}
                    strokeWidth={2}
                    dot={false}
                    activeDot={false}
                    animationDuration={600}
                  />
                  {maxPoint && (
                    <ReferenceDot
                      x={maxPoint.date}
                      y={maxPoint.topSetKg}
                      r={4}
                      fill={PR_HEX}
                      stroke="none"
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section className="section" style={{ marginTop: 'var(--space-5)' }}>
          <div className="section__head">
            <h3 className="type-display-m">Recent</h3>
          </div>
          <div className="list-group">
            {recent.map((r, i) => (
              <div key={`${r.date}-${i}`} className="log-row">
                <span className="log-row__main">
                  <span className="log-row__stats">
                    {r.sets.map((s) => fmtSetCompact(s, exercise.type)).join(' · ')}
                    {r.sets.some((s) => holdsRecord(s, exercise.type, pr)) && (
                      <span className="set-line__pr" style={{ marginLeft: 'var(--space-2)' }}>
                        PR
                      </span>
                    )}
                  </span>
                </span>
                <span className="log-row__date">{fmtShortDate(r.date)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {points.length <= 1 && recent.length === 0 && <EmptyNotice text={EMPTY_COPY} />}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Bodyweight — trend chart, key stats, quick log                       */
/* ------------------------------------------------------------------ */

const WEIGHT_HEX = '#F4EEE4' // neutral cream — bodyweight is not a sport
const WEIGHT_RAW = 'rgba(244, 238, 228, 0.30)'

function WeightSection() {
  const { data, error, loading, reload } = useAsync(api.bodyweight)

  if (loading) return <Skel h={240} r="var(--radius-m)" />
  if (error || !data) {
    return <ErrorNotice message={error ?? 'Something went wrong.'} onRetry={reload} />
  }
  return <WeightCard data={data} onLogged={reload} />
}

function WeightCard({ data, onLogged }: { data: BodyweightResponse; onLogged: () => void }) {
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const today = todayIso()
  const hasToday = data.entries.some((e) => e.date === today)

  // Last 12 weeks of weigh-ins, each with a trailing 7-day average.
  const points = useMemo(() => {
    const from = addDays(today, -84)
    return data.entries
      .filter((e) => e.date >= from)
      .map((e) => {
        const winStart = addDays(e.date, -6)
        const win = data.entries.filter((x) => x.date >= winStart && x.date <= e.date)
        const avg = win.reduce((sum, x) => sum + x.weightKg, 0) / win.length
        return { date: e.date, kg: e.weightKg, avg: Math.round(avg * 10) / 10 }
      })
  }, [data, today])
  const last = points[points.length - 1]

  const kg = Number(value.replace(',', '.'))
  const valid = value.trim() !== '' && Number.isFinite(kg) && kg >= 30 && kg <= 250

  const submit = async (ev: FormEvent) => {
    ev.preventDefault()
    if (!valid) return
    setSaving(true)
    setFormError(null)
    try {
      await api.logWeight(today, Math.round(kg * 10) / 10)
      setValue('')
      onLogged()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save the weigh-in.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {data.currentKg == null ? (
        <EmptyNotice text="No weigh-ins yet. Step on the scale and log the first one." />
      ) : (
        <div className="weight-card">
          <div className="weight-card__vals">
            <span className="weight-card__current">
              {fmtKg(data.currentKg)}
              <em>KG</em>
            </span>
            {data.delta30dKg != null && (
              <span className="weight-card__delta">
                {data.delta30dKg >= 0 ? '+' : '−'}
                {fmtKg(Math.abs(data.delta30dKg))} · 30D
              </span>
            )}
          </div>

          {points.length > 1 && (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={points} margin={{ top: 12, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid vertical={false} stroke={GRID} strokeWidth={1} />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={TICK}
                  interval={Math.max(0, Math.ceil(points.length / 4) - 1)}
                  tickFormatter={shortWeek}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={TICK}
                  tickCount={4}
                  domain={['dataMin - 0.5', 'dataMax + 0.5']}
                  tickFormatter={fmtKg}
                />
                <Line
                  type="monotone"
                  dataKey="kg"
                  stroke={WEIGHT_RAW}
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={false}
                  animationDuration={600}
                />
                <Line
                  type="monotone"
                  dataKey="avg"
                  stroke={WEIGHT_HEX}
                  strokeWidth={2}
                  dot={false}
                  activeDot={false}
                  animationDuration={600}
                />
                {last && (
                  <ReferenceDot x={last.date} y={last.kg} r={4} fill={WEIGHT_HEX} stroke="none" />
                )}
              </LineChart>
            </ResponsiveContainer>
          )}

          <div className="chart-key weight-card__meta">
            {data.avg7dKg != null && (
              <span className="chart-key__item">
                7D avg<b className="weight-card__meta-val">{fmtKg(data.avg7dKg)}</b>
              </span>
            )}
            {data.minKg != null && (
              <span className="chart-key__item">
                Low<b className="weight-card__meta-val">{fmtKg(data.minKg)}</b>
              </span>
            )}
            {data.maxKg != null && (
              <span className="chart-key__item">
                High<b className="weight-card__meta-val">{fmtKg(data.maxKg)}</b>
              </span>
            )}
          </div>
        </div>
      )}

      <form className="weight-log" onSubmit={(ev) => void submit(ev)}>
        <input
          className="input input--mono"
          type="text"
          inputMode="decimal"
          aria-label="Bodyweight in kilograms"
          placeholder={data.currentKg != null ? `${fmtKg(data.currentKg)} kg` : 'kg'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button type="submit" className="btn btn--primary" disabled={saving || !valid}>
          {saving ? 'Saving…' : hasToday ? 'Update' : 'Log'}
        </button>
      </form>
      {formError && <p className="form-error">{formError}</p>}
    </>
  )
}

/* ------------------------------------------------------------------ */

function ProgressSkeleton() {
  return (
    <main className="screen" aria-busy="true">
      <header className="screen-title">
        <h1 className="type-display-l">Progress</h1>
      </header>
      <Skel h={96} r="var(--radius-m)" />
      <Skel h={252} r="var(--radius-m)" style={{ marginTop: 'var(--space-8)' }} />
      <div
        className="lift-grid"
        style={{ marginTop: 'var(--space-8)' }}
      >
        {[0, 1, 2, 3].map((i) => (
          <Skel key={i} h={140} r="var(--radius-m)" />
        ))}
      </div>
      <Skel h={240} r="var(--radius-m)" style={{ marginTop: 'var(--space-8)' }} />
    </main>
  )
}
