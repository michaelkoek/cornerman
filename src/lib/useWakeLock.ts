import { useEffect } from 'react'

/**
 * Keeps the screen awake while `active` (gym use: phone on the bench, timer
 * running). The lock is auto-released by the browser on tab hide, so it is
 * re-requested on visibilitychange. Silently a no-op where unsupported.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) {
      return
    }

    let lock: WakeLockSentinel | null = null
    let cancelled = false

    const acquire = async () => {
      try {
        const sentinel = await navigator.wakeLock.request('screen')
        if (cancelled) {
          await sentinel.release()
          return
        }
        lock = sentinel
      } catch {
        // Denied (low battery, browser policy) or unsupported — timer math is
        // wall-clock based, so losing the lock never affects correctness.
        lock = null
      }
    }

    const reacquire = () => {
      if (document.visibilityState === 'visible') {
        void acquire()
      }
    }

    void acquire()
    document.addEventListener('visibilitychange', reacquire)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', reacquire)
      lock?.release().catch(() => {
        // Already released by the browser on tab hide — nothing to clean up.
      })
    }
  }, [active])
}
