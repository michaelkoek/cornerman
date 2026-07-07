import { useCallback, useEffect, useRef, useState } from 'react'

interface AsyncState<T> {
  data: T | null
  error: string | null
  loading: boolean
}

/**
 * Tiny per-route fetch hook. Refetch with `reload()`; mutate optimistically
 * with `setData()` (updater form supported).
 */
export function useAsync<T>(fn: () => Promise<T>) {
  const fnRef = useRef(fn)
  fnRef.current = fn

  const [state, setState] = useState<AsyncState<T>>({ data: null, error: null, loading: true })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let alive = true
    setState((s) => ({ ...s, loading: true, error: null }))
    fnRef
      .current()
      .then((data) => {
        if (alive) setState({ data, error: null, loading: false })
      })
      .catch((err: unknown) => {
        if (alive) {
          setState((s) => ({
            ...s,
            loading: false,
            error: err instanceof Error ? err.message : 'Request failed',
          }))
        }
      })
    return () => {
      alive = false
    }
  }, [tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])

  const setData = useCallback((next: T | ((prev: T) => T)) => {
    setState((s) => {
      if (s.data === null) return s
      const data = typeof next === 'function' ? (next as (prev: T) => T)(s.data) : next
      return { ...s, data }
    })
  }, [])

  return { ...state, reload, setData }
}

/** Keeps the last non-null value around (lets sheet content persist while the
 *  sheet animates closed). */
export function usePersist<T>(value: T | null): T | null {
  const ref = useRef<T | null>(null)
  if (value !== null) ref.current = value
  return value ?? ref.current
}
