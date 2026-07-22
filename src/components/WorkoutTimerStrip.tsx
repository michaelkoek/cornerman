import { useEffect } from 'react'
import type { Session } from '../../shared/types'
import { fmtRunTime, sportClass } from '../lib/format'
import { useElapsedTimer } from '../lib/useElapsedTimer'
import { useWakeLock } from '../lib/useWakeLock'
import { BottomLayer } from './BottomLayer'

interface IWorkoutTimerStripProps {
  session: Session
  onPause: () => void
  onResume: () => void
  onFinish: () => void
}

const BASE_TITLE = 'Cornerman'

function useTitleTick(running: boolean, elapsed: number): void {
  useEffect(() => {
    if (!running) {
      return
    }
    document.title = `${fmtRunTime(elapsed)} · ${BASE_TITLE}`
    return () => {
      document.title = BASE_TITLE
    }
  }, [running, elapsed])
}

const buzz = () => {
  try {
    navigator.vibrate?.([30])
  } catch {
    // Haptics unavailable — purely decorative feedback, safe to skip.
  }
}

/**
 * Strava-style elapsed-time banner pinned above the active workout. Sticky
 * (not fixed) on purpose: position: fixed detaches under animated ancestors
 * (see BottomLayer docblock); sticky pins against the .app-scroll scrollport
 * and keeps layout flow. The paused Resume/Finish bar IS bottom-fixed chrome,
 * so that part portals through BottomLayer.
 */
export function WorkoutTimerStrip({ session, onPause, onResume, onFinish }: IWorkoutTimerStripProps) {
  const elapsed = useElapsedTimer(session.startedAt, session.elapsedSec)
  const running = session.startedAt !== null

  useWakeLock(running)
  useTitleTick(running, elapsed)

  const toggle = () => {
    buzz()
    if (running) {
      onPause()
    } else {
      onResume()
    }
  }

  const finish = () => {
    buzz()
    onFinish()
  }

  return (
    <>
      <section
        className={`workout-strip ${sportClass(session.sport)} ${running ? '' : 'is-paused'}`}
        role="timer"
        aria-label={`Workout elapsed time, ${running ? 'running' : 'paused'}`}
      >
        <span className="workout-strip__state">
          <span className="workout-strip__dot" aria-hidden="true" />
          <span className="type-eyebrow">{running ? 'Live' : 'Paused'}</span>
        </span>
        <span className="workout-strip__digits">{fmtRunTime(elapsed)}</span>
        <button type="button" className="btn btn--ghost workout-strip__btn" onClick={toggle}>
          {running ? 'Pause' : 'Resume'}
        </button>
      </section>
      {!running && (
        <BottomLayer>
          <section className="workout-pause-bar" aria-label="Paused workout actions">
            <button type="button" className="btn btn--primary" onClick={toggle}>
              Resume
            </button>
            <button type="button" className="btn btn--ghost" onClick={finish}>
              Finish
            </button>
          </section>
        </BottomLayer>
      )}
    </>
  )
}
