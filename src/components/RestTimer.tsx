import { useEffect, useRef, useState } from 'react'
import { fmtClock } from '../lib/format'

interface RestTimerProps {
  seconds?: number
  onDone: () => void
}

/**
 * Rest timer bottom sheet per DESIGN.md §5.4 — not a modal: the exercise
 * list stays visible and tappable above it. −15 / SKIP / +15 controls,
 * red pulse in the final 10s, bell flash + haptics at 0:00.
 */
export function RestTimer({ seconds = 90, onDone }: RestTimerProps) {
  const [open, setOpen] = useState(false)
  const [total, setTotal] = useState(seconds)
  const [remaining, setRemaining] = useState(seconds)
  const [bell, setBell] = useState(false)
  const endRef = useRef(Date.now() + seconds * 1000)
  const belledRef = useRef(false)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)))
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => {
      const left = Math.max(0, Math.round((endRef.current - Date.now()) / 1000))
      setRemaining(left)
      if (left === 0 && !belledRef.current) {
        belledRef.current = true
        setBell(true)
        try {
          if ('vibrate' in navigator) navigator.vibrate([80, 60, 80])
        } catch {
          /* haptics unavailable */
        }
        window.setTimeout(() => onDoneRef.current(), 900)
      }
    }, 200)
    return () => window.clearInterval(id)
  }, [])

  const adjust = (delta: number) => {
    if (belledRef.current) return
    endRef.current = Math.max(Date.now(), endRef.current + delta * 1000)
    if (delta > 0) setTotal((t) => t + delta)
    setRemaining(Math.max(0, Math.round((endRef.current - Date.now()) / 1000)))
  }

  const fraction = total > 0 ? Math.min(1, remaining / total) : 0

  return (
    <div
      className={`timer-sheet corner-bracket ${open ? 'is-open' : ''} ${bell ? 'is-bell' : ''}`}
      role="timer"
      aria-label="Rest timer"
    >
      <div className="timer-sheet__inner">
        <p className="type-eyebrow timer-sheet__eyebrow">Rest — breathe</p>
        <div className={`timer-sheet__digits ${remaining <= 10 && !bell ? 'is-final' : ''}`}>
          {fmtClock(remaining)}
        </div>
        <div className="timer-sheet__track">
          <div className="timer-sheet__fill" style={{ transform: `scaleX(${fraction})` }} />
        </div>
        <div className="timer-sheet__controls">
          <button type="button" className="btn btn--ghost" onClick={() => adjust(-15)}>
            <span className="type-data-m">−15</span>
          </button>
          <button type="button" className="btn btn--ghost" onClick={onDone}>
            Skip
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => adjust(15)}>
            <span className="type-data-m">+15</span>
          </button>
        </div>
      </div>
    </div>
  )
}
