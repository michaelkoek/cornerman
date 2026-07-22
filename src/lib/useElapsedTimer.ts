import { useEffect, useState } from 'react'
import { elapsedSecondsAt } from './workoutTimer'

/**
 * Live elapsed seconds for the workout timer. Recomputes from the wall clock
 * every 500ms while running (same resilience pattern as RestTimer) and snaps
 * to the true value the moment a backgrounded tab becomes visible again.
 */
export function useElapsedTimer(startedAt: number | null, baseElapsedSec: number): number {
  const [elapsed, setElapsed] = useState(() =>
    elapsedSecondsAt({ startedAt, elapsedSec: baseElapsedSec }, Date.now()),
  )

  useEffect(() => {
    const recompute = () => {
      setElapsed(elapsedSecondsAt({ startedAt, elapsedSec: baseElapsedSec }, Date.now()))
    }
    recompute()
    if (startedAt === null) {
      return
    }
    const interval = window.setInterval(recompute, 500)
    document.addEventListener('visibilitychange', recompute)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', recompute)
    }
  }, [startedAt, baseElapsedSec])

  return elapsed
}
