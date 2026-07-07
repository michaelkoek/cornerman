import { useCallback, useEffect, useRef } from 'react'
import { IconMinus, IconPlus } from './icons'

/** Long-press auto-repeat: fires once on press, then every 120ms after 400ms hold. */
function useRepeat(fn: () => void) {
  const fnRef = useRef(fn)
  fnRef.current = fn
  const timeout = useRef<number | null>(null)
  const interval = useRef<number | null>(null)

  const stop = useCallback(() => {
    if (timeout.current !== null) window.clearTimeout(timeout.current)
    if (interval.current !== null) window.clearInterval(interval.current)
    timeout.current = null
    interval.current = null
  }, [])

  const start = useCallback(() => {
    fnRef.current()
    timeout.current = window.setTimeout(() => {
      interval.current = window.setInterval(() => fnRef.current(), 120)
    }, 400)
  }, [])

  useEffect(() => stop, [stop])

  return { start, stop }
}

interface StepperProps {
  value: number
  unit: string
  step: number
  min?: number
  max?: number
  onChange: (next: number) => void
  format?: (v: number) => string
}

/** 56px [−] value [+] stepper per DESIGN.md §5.3. */
export function Stepper({ value, unit, step, min = 0, max = 999, onChange, format }: StepperProps) {
  // useRepeat reads through a ref, so these closures always see the latest value
  const valueRef = useRef(value)
  valueRef.current = value
  const decFn = useRepeat(() => onChange(Math.max(min, round(valueRef.current - step))))
  const incFn = useRepeat(() => onChange(Math.min(max, round(valueRef.current + step))))

  return (
    <div className="stepper">
      <button
        type="button"
        className="stepper__btn"
        aria-label={`Decrease ${unit}`}
        onPointerDown={decFn.start}
        onPointerUp={decFn.stop}
        onPointerLeave={decFn.stop}
        onPointerCancel={decFn.stop}
        onContextMenu={(e) => e.preventDefault()}
      >
        <IconMinus size={20} />
      </button>
      <div className="stepper__value-block">
        <span className="stepper__value">{format ? format(value) : value}</span>
        <span className="stepper__unit">{unit}</span>
      </div>
      <button
        type="button"
        className="stepper__btn"
        aria-label={`Increase ${unit}`}
        onPointerDown={incFn.start}
        onPointerUp={incFn.stop}
        onPointerLeave={incFn.stop}
        onPointerCancel={incFn.stop}
        onContextMenu={(e) => e.preventDefault()}
      >
        <IconPlus size={20} />
      </button>
    </div>
  )
}

function round(v: number): number {
  return Math.round(v * 100) / 100
}
