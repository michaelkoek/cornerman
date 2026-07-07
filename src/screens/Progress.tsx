import { useMemo } from 'react'
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
import type { DashboardResponse, Sport } from '../../shared/types'
import { api } from '../lib/api'
import { SPORTS, SPORT_HEX, SPORT_LABEL, fmtKg, parseIso } from '../lib/format'
import { useAsync } from '../lib/useAsync'
import { EmptyNotice, ErrorNotice, Skel } from '../components/Skeleton'

/* Ringside scoreboard chart styling — no recharts defaults (DESIGN.md §5.6). */
const TICK = {
  fill: 'rgba(244, 238, 228, 0.42)',
  fontSize: 11,
  fontFamily: "'Spline Sans Mono', ui-monospace, monospace",
}
const GRID = 'rgba(244, 238, 228, 0.08)'
const EMPTY_COPY = 'Nothing logged yet. First bell rings when you do.'

export default function Progress() {
  const { data, error, loading, reload } = useAsync(api.dashboard)

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
              <LiftCard key={lift.exerciseId} lift={lift} />
            ))}
          </div>
        )}
      </section>
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

  if (!hasVolume) return <EmptyNotice text={EMPTY_COPY} />

  return (
    <>
      <div className="chart-plot">
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

function LiftCard({ lift }: { lift: DashboardResponse['liftProgression'][number] }) {
  const points = lift.points
  const last = points[points.length - 1]
  const first = points[0]
  const delta = last && first ? last.est1Rm - first.est1Rm : 0

  return (
    <div className="lift-card">
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
    </div>
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
    </main>
  )
}
