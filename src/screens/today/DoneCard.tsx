import { useState } from 'react'
import type { Session } from '../../../shared/types'
import { SPORT_LABEL, fmtDayEyebrow, fmtRunTime, sportClass, workoutTitle } from '../../lib/format'
import { st } from '../../lib/stagger'
import { ManualLogSheet } from '../../components/ManualLogSheet'
import { DiscardSheet } from '../../components/DiscardSheet'

interface IDoneCardProps {
  session: Session
  date: string
  onSaved: () => void
}

export function DoneCard({ session, date, onSaved }: IDoneCardProps) {
  const [logOpen, setLogOpen] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const bits: string[] = []
  if (session.elapsedSec > 0) {
    bits.push(fmtRunTime(session.elapsedSec))
  } else if (session.durationMin != null) {
    bits.push(`${session.durationMin} MIN`)
  }
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
