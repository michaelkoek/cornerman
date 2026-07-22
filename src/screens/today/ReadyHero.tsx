import { useState } from 'react'
import type { TodayResponse } from '../../../shared/types'
import { RECOVERY_HINT, fmtDayEyebrow } from '../../lib/format'
import { st } from '../../lib/stagger'
import { ManualLogSheet } from '../../components/ManualLogSheet'

interface IReadyHeroProps {
  data: TodayResponse
  onLogged: () => void
}

/** Rest-day hero for an empty Today: nothing scheduled, nothing built yet. */
export function ReadyHero({ data, onLogged }: IReadyHeroProps) {
  const [logOpen, setLogOpen] = useState(false)
  const round = Math.min(data.weekSessions + 1, Math.max(data.weeklyTarget, 1))
  const name = data.yesterdayLoad === 'hard' ? 'Recovery day' : 'Open mat'

  return (
    <>
      <section
        className="card card--hero corner-cut corner-bracket hero--rest stagger-item"
        style={st(0)}
      >
        <div className="hero__eyebrow-row">
          <span className="type-eyebrow">Today · {fmtDayEyebrow(data.date)}</span>
        </div>
        <h2 className="type-display-xl hero__name">{name}</h2>
        <p className="hero__meta">
          Nothing scheduled · RD {round}/{data.weeklyTarget} this week
        </p>
        <p className="coach-line">{RECOVERY_HINT[data.yesterdayLoad]}</p>
        <button type="button" className="btn btn--ghost hero__cta" onClick={() => setLogOpen(true)}>
          Log something anyway
        </button>
      </section>

      <ManualLogSheet
        open={logOpen}
        onClose={() => setLogOpen(false)}
        onSaved={() => {
          setLogOpen(false)
          onLogged()
        }}
      />
    </>
  )
}
