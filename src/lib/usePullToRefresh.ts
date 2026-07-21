import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

/** Pull distance (post-damping, px) required to arm a refresh. */
const PULL_THRESHOLD = 64
/** Hard cap on indicator travel so the pull feels elastic. */
const MAX_PULL = 96
/** Finger travel is halved for a native-feeling drag resistance. */
const DAMPING = 0.5
/** Keep the spinner visible at least this long so it never flashes. */
const MIN_SPIN_MS = 500
/** Force-retract if a refresh never reports completion. */
const FAILSAFE_MS = 10000

export type PullPhase = 'idle' | 'pulling' | 'refreshing'

interface IPullToRefreshOptions {
  onRefresh: () => void
  refreshing: boolean
}

interface IPullToRefreshHandle {
  indicatorRef: RefObject<HTMLDivElement | null>
  phase: PullPhase
}

const shouldIgnoreTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof Element)) {
    return false
  }
  return target.closest('.sheet, .sheet__backdrop, dialog') !== null
}

/**
 * Custom pull-to-refresh for the app scroller (`.app-scroll` — the document
 * itself never scrolls). The browser's native gesture is disabled via
 * `overscroll-behavior-y: none`, so this listens to window touch events
 * (passively — no scroll jank), translates the indicator while the user drags
 * from the top, and arms past the threshold. Pull distance is written straight
 * to CSS custom properties to avoid re-rendering on every touchmove.
 */
export function usePullToRefresh({ onRefresh, refreshing }: IPullToRefreshOptions): IPullToRefreshHandle {
  const indicatorRef = useRef<HTMLDivElement | null>(null)
  const [phase, setPhase] = useState<PullPhase>('idle')

  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh

  const startYRef = useRef<number | null>(null)
  const pullRef = useRef(0)
  const refreshStartRef = useRef(0)

  useEffect(() => {
    // The indicator mounts inside .app-scroll and both remount together on
    // navigation, so resolving the scroller once per mount is never stale.
    const scroller = indicatorRef.current?.closest('.app-scroll') ?? null
    const isScrolled = () => (scroller ? scroller.scrollTop > 0 : window.scrollY > 0)

    const setPull = (pull: number) => {
      pullRef.current = pull
      const el = indicatorRef.current
      if (!el) {
        return
      }
      el.style.setProperty('--ptr-pull', `${pull}px`)
      el.style.setProperty('--ptr-progress', `${Math.min(1, pull / PULL_THRESHOLD)}`)
      el.dataset.armed = pull >= PULL_THRESHOLD ? 'true' : 'false'
    }

    const resetPull = () => {
      startYRef.current = null
      setPull(0)
      if (phaseRef.current === 'pulling') {
        setPhase('idle')
      }
    }

    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0]
      if (!touch || phaseRef.current === 'refreshing' || isScrolled()) {
        return
      }
      if (shouldIgnoreTarget(event.target)) {
        return
      }
      startYRef.current = touch.clientY
    }

    const onTouchMove = (event: TouchEvent) => {
      const startY = startYRef.current
      const touch = event.touches[0]
      if (startY === null || !touch || phaseRef.current === 'refreshing') {
        return
      }
      if (isScrolled()) {
        resetPull()
        return
      }
      const dy = touch.clientY - startY
      if (dy <= 0) {
        setPull(0)
        if (phaseRef.current === 'pulling') {
          setPhase('idle')
        }
        return
      }
      const wasArmed = pullRef.current >= PULL_THRESHOLD
      const pull = Math.min(MAX_PULL, dy * DAMPING)
      setPull(pull)
      if (phaseRef.current === 'idle') {
        setPhase('pulling')
      }
      if (!wasArmed && pull >= PULL_THRESHOLD && 'vibrate' in navigator) {
        navigator.vibrate(10)
      }
    }

    const onTouchEnd = () => {
      if (startYRef.current === null || phaseRef.current !== 'pulling') {
        startYRef.current = null
        return
      }
      const armed = pullRef.current >= PULL_THRESHOLD
      startYRef.current = null
      setPull(0)
      if (armed) {
        refreshStartRef.current = Date.now()
        setPhase('refreshing')
        onRefreshRef.current()
      } else {
        setPhase('idle')
      }
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    window.addEventListener('touchcancel', resetPull, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('touchcancel', resetPull)
    }
  }, [])

  useEffect(() => {
    if (phase !== 'refreshing') {
      return
    }
    const failsafe = setTimeout(() => setPhase('idle'), FAILSAFE_MS)
    if (refreshing) {
      return () => clearTimeout(failsafe)
    }
    const elapsed = Date.now() - refreshStartRef.current
    const retract = setTimeout(() => setPhase('idle'), Math.max(0, MIN_SPIN_MS - elapsed))
    return () => {
      clearTimeout(failsafe)
      clearTimeout(retract)
    }
  }, [phase, refreshing])

  return { indicatorRef, phase }
}
