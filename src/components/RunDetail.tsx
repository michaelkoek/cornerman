import type { IRunDetail, IRunSplit, Session } from '../../shared/types'
import { fmtPace, fmtRunTime } from '../lib/format'

interface RunDetailProps {
  session: Session
  run: IRunDetail
}

interface StatItem {
  label: string
  value: string
}

function buildStats(session: Session, run: IRunDetail): StatItem[] {
  const stats: StatItem[] = []
  const pausedSec = run.elapsedTimeSec - run.movingTimeSec
  if (pausedSec > 0) {
    stats.push({ label: 'Paused', value: fmtRunTime(pausedSec) })
  }
  if (session.avgHr != null) {
    const max = run.maxHr != null ? ` / ${run.maxHr}` : ''
    stats.push({ label: `Heart rate${max ? ' avg / max' : ''}`, value: `${Math.round(session.avgHr)}${max}` })
  }
  if (run.elevationGainM != null) {
    stats.push({ label: 'Elevation gain', value: `${run.elevationGainM} m` })
  }
  if (run.avgCadence != null) {
    stats.push({ label: 'Cadence', value: `${run.avgCadence} spm` })
  }
  if (run.calories != null) {
    stats.push({ label: 'Calories', value: `${run.calories} kcal` })
  }
  return stats
}

/** Rich Strava run recap inside the workout detail sheet. */
export function RunDetail({ session, run }: RunDetailProps) {
  const stats = buildStats(session, run)

  return (
    <section className="run-detail" aria-label="Run details">
      <div className="stat-row">
        <div className="stat-block">
          <p className="stat-block__value">
            {session.distanceKm != null ? session.distanceKm.toFixed(2) : '—'}
            <em>KM</em>
          </p>
          <p className="stat-block__label type-eyebrow">Distance</p>
        </div>
        <div className="stat-block">
          <p className="stat-block__value">{fmtRunTime(run.movingTimeSec)}</p>
          <p className="stat-block__label type-eyebrow">Moving time</p>
        </div>
        <div className="stat-block">
          <p className="stat-block__value">
            {session.avgPaceSecPerKm != null ? fmtPace(session.avgPaceSecPerKm) : '—'}
            <em>/KM</em>
          </p>
          <p className="stat-block__label type-eyebrow">Avg pace</p>
        </div>
        <div className="stat-block">
          <p className="stat-block__value">{fmtRunTime(run.elapsedTimeSec)}</p>
          <p className="stat-block__label type-eyebrow">Elapsed</p>
        </div>
      </div>

      {stats.length > 0 && (
        <ul className="run-detail__stats">
          {stats.map((stat) => (
            <li key={stat.label} className="run-detail__stat">
              <span className="type-eyebrow">{stat.label}</span>
              <span className="run-detail__stat-value">{stat.value}</span>
            </li>
          ))}
        </ul>
      )}

      {run.splits.length > 0 && <Splits splits={run.splits} />}
    </section>
  )
}

function Splits({ splits }: { splits: IRunSplit[] }) {
  const paces = splits.map((s) => s.paceSecPerKm).filter((p): p is number => p != null)
  const fastest = Math.min(...paces)
  const slowest = Math.max(...paces)

  const barWidth = (pace: number | null): number => {
    if (pace == null) {
      return 0
    }
    if (slowest === fastest) {
      return 100
    }
    // Fastest split gets the full bar; slower splits shrink toward 40%.
    return 100 - ((pace - fastest) / (slowest - fastest)) * 60
  }

  return (
    <section className="run-detail__splits" aria-label="Splits per kilometre">
      <h3 className="type-eyebrow run-detail__splits-title">Splits</h3>
      <ul className="run-detail__split-list">
        {splits.map((split) => (
          <li key={split.km} className="run-split">
            <span className="run-split__km type-eyebrow">
              {split.distanceM < 950 ? `${(split.distanceM / 1000).toFixed(1)}` : split.km}
            </span>
            <span className="run-split__bar-track">
              <span className="run-split__bar" style={{ width: `${barWidth(split.paceSecPerKm)}%` }} />
            </span>
            <span className="run-split__pace">
              {split.paceSecPerKm != null ? fmtPace(split.paceSecPerKm) : '—'}
            </span>
            <span className="run-split__elev">
              {split.elevDiffM != null ? `${split.elevDiffM > 0 ? '+' : ''}${Math.round(split.elevDiffM)}m` : ''}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
