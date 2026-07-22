import type { Session } from '../../shared/types'
import type { SessionPatch } from './api'

type TimerFields = Pick<Session, 'startedAt' | 'elapsedSec'>

/**
 * Wall-clock elapsed seconds. Derived, never ticked-and-stored, so it survives
 * reloads and background-tab throttling. Clamped so a device clock that jumps
 * backwards can't produce a negative segment.
 */
export function elapsedSecondsAt(timer: TimerFields, nowMs: number): number {
  const runningSec = timer.startedAt !== null ? Math.max(0, (nowMs - timer.startedAt) / 1000) : 0
  return Math.floor(timer.elapsedSec + runningSec)
}

export function startTimerPatch(nowMs: number): SessionPatch {
  return { status: 'in_progress', startedAt: nowMs }
}

export function pauseTimerPatch(timer: TimerFields, nowMs: number): SessionPatch {
  return { startedAt: null, elapsedSec: elapsedSecondsAt(timer, nowMs) }
}

export function resumeTimerPatch(nowMs: number): SessionPatch {
  return { startedAt: nowMs }
}

/**
 * Folds the running segment into a final elapsedSec and mirrors it into
 * durationMin so weekly-volume math uses measured time. When the timer never
 * ran, the planned durationMin is left untouched.
 */
export function finishTimerPatch(timer: TimerFields, nowMs: number): SessionPatch {
  const finalSec = elapsedSecondsAt(timer, nowMs)
  if (finalSec <= 0) {
    return { startedAt: null }
  }
  return {
    startedAt: null,
    elapsedSec: finalSec,
    durationMin: Math.max(1, Math.round(finalSec / 60)),
  }
}
