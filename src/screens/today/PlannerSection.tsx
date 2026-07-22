import { useState } from 'react'
import type { FocusTarget, Location, Session, WorkoutSplit } from '../../../shared/types'
import { api } from '../../lib/api'
import { FocusPlanner } from './FocusPlanner'
import { Planner } from './Planner'

/**
 * The two workout builders on Today: the split planner and the muscle-focus
 * planner. Time + location are picked once here and shared by both; either
 * build button replaces today's planned session.
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

  const build = async (opts: { split?: WorkoutSplit; focus?: FocusTarget }) => {
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
        ...opts,
      })
      onSession(session)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not build a workout.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
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
        onBuild={(split) => void build({ split: split ?? undefined })}
      />
      <FocusPlanner minutes={minutes} busy={busy} onBuild={(focus) => void build({ focus })} />
    </>
  )
}
