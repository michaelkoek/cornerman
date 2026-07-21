import { useEffect, useRef, useState, type TouchEvent } from 'react'
import { fmtClock } from '../lib/format'
import { BottomLayer } from './BottomLayer'

interface RestTimerProps {
  seconds?: number
  onDone: () => void
}

/** Drag distance (px) past which releasing the grabber skips the timer. */
const SKIP_THRESHOLD = 96

/**
 * Rest timer bottom sheet per DESIGN.md §5.4 — not a modal: the exercise
 * list stays visible and tappable above it. −15 / SKIP / +15 controls,
 * red pulse in the final 10s, bell flash + haptics at 0:00. Dragging the
 * grabber down past the threshold skips the timer.
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

  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const startY = useRef(0)
  const tracking = useRef(false)

  const adjust = (delta: number) => {
    if (belledRef.current) return
    endRef.current = Math.max(Date.now(), endRef.current + delta * 1000)
    if (delta > 0) setTotal((t) => t + delta)
    setRemaining(Math.max(0, Math.round((endRef.current - Date.now()) / 1000)))
  }

  const onGrabTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0]
    if (!touch) {
      return
    }
    startY.current = touch.clientY
    tracking.current = true
  }

  const onGrabTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    if (!tracking.current) {
      return
    }
    const touch = e.touches[0]
    if (!touch) {
      return
    }
    const dy = touch.clientY - startY.current
    if (dy <= 0) {
      if (dragging) {
        setDragging(false)
        setDragY(0)
      }
      return
    }
    setDragging(true)
    setDragY(dy)
  }

  const onGrabTouchEnd = () => {
    if (!tracking.current) {
      return
    }
    tracking.current = false
    if (dragY > SKIP_THRESHOLD) {
      onDone()
    }
    setDragging(false)
    setDragY(0)
  }

  const fraction = total > 0 ? Math.min(1, remaining / total) : 0

  return (
    <BottomLayer>
      <div
        className={`timer-sheet corner-bracket ${open ? 'is-open' : ''} ${bell ? 'is-bell' : ''}`}
        style={dragging ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
        role="timer"
        aria-label="Rest timer"
      >
        <div className="timer-sheet__inner">
          <div
            className="timer-sheet__grab"
            onTouchStart={onGrabTouchStart}
            onTouchMove={onGrabTouchMove}
            onTouchEnd={onGrabTouchEnd}
            onTouchCancel={onGrabTouchEnd}
          >
            <span className="sheet__grabber" aria-hidden="true" />
            <p className="type-eyebrow timer-sheet__eyebrow">Rest — breathe</p>
          </div>
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
    </BottomLayer>
  )
}
