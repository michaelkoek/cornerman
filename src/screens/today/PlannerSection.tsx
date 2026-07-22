import { useState } from 'react'
import type { Location, Session } from '../../../shared/types'
import { api } from '../../lib/api'
import { Planner, type Emphasis } from './Planner'

/**
 * The workout builder on Today: time + location + an optional emphasis
 * (push/pull/legs split or a muscle focus) behind a single build CTA.
 * Building replaces today's planned session.
 */
export function PlannerSection({
  onSession,
  secondary = false,
}: {
  onSession: (s: Session) => void
  secondary?: boolean
}) {
  const [minutes, setMinutes] = useState<20 | 45 | 60 | null>(null)
  const [location, setLocation] = useState<Location>('gym')
  const [machinesOnly, setMachinesOnly] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pickLocation = (loc: Location) => {
    setLocation(loc)
    if (loc === 'home') {
      setMachinesOnly(false)
    }
  }

  const build = async (emphasis: Emphasis | null) => {
    if (!minutes || busy) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      const session = await api.suggest({
        minutes,
        location,
        machinesOnly: location === 'gym' && machinesOnly,
        split: emphasis?.kind === 'split' ? emphasis.value : undefined,
        focus: emphasis?.kind === 'focus' ? emphasis.value : undefined,
      })
      onSession(session)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not build a workout.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Planner
      secondary={secondary}
      minutes={minutes}
      onMinutes={setMinutes}
      location={location}
      onLocation={pickLocation}
      machinesOnly={machinesOnly}
      onMachinesOnly={setMachinesOnly}
      busy={busy}
      error={error}
      onBuild={(emphasis) => void build(emphasis)}
    />
  )
}
