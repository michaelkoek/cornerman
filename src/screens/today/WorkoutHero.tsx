import type { Session, TodayResponse } from '../../../shared/types'
import { SPORT_LABEL, fmtDayEyebrow, sportClass, workoutTitle } from '../../lib/format'
import { st } from '../../lib/stagger'

interface IWorkoutHeroProps {
  today: TodayResponse
  session: Session
  round: number
  exerciseCount: number
  onStart: () => void
}

export function WorkoutHero({ today, session, round, exerciseCount, onStart }: IWorkoutHeroProps) {
  return (
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
        {session.durationMin ?? '—'} min · {exerciseCount} exercises · RD {round}/
        {today.weeklyTarget} this week
      </p>
      {session.status === 'planned' && (
        <button type="button" className="btn btn--primary hero__cta" onClick={onStart}>
          Start session
        </button>
      )}
    </section>
  )
}
