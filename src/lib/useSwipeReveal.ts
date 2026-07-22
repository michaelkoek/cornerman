import { useEffect, useRef, useState } from 'react'
import type { RefObject, TouchEvent as ReactTouchEvent } from 'react'

/** Width (px) of the action revealed behind the row; matches .swipe-row__action. */
export const SWIPE_ACTION_WIDTH = 88
/** Finger travel before the gesture commits to an axis. */
const AXIS_SLOP = 10
/** Resistance applied when dragging past the fully revealed position. */
const OVERSHOOT_DAMPING = 0.25

type SwipeAxis = 'undecided' | 'x' | 'y'

interface ISwipeRevealOptions {
  revealed: boolean
  onRevealChange: (revealed: boolean) => void
}

interface ISwipeRevealHandlers {
  onTouchStart: (event: ReactTouchEvent<HTMLElement>) => void
  onTouchMove: (event: ReactTouchEvent<HTMLElement>) => void
  onTouchEnd: () => void
  onTouchCancel: () => void
}

interface ISwipeRevealHandle {
  rootRef: RefObject<HTMLDivElement | null>
  offset: number
  dragging: boolean
  consumeDrag: () => boolean
  handlers: ISwipeRevealHandlers
}

const clampOffset = (raw: number): number => {
  if (raw > 0) {
    return 0
  }
  if (raw < -SWIPE_ACTION_WIDTH) {
    const overshoot = -SWIPE_ACTION_WIDTH - raw
    return -SWIPE_ACTION_WIDTH - overshoot * OVERSHOOT_DAMPING
  }
  return raw
}

const offsetIsArmed = (offset: number): boolean => {
  return offset <= -SWIPE_ACTION_WIDTH / 2
}

/**
 * Swipe-left-to-reveal for list rows (the wrapper needs `touch-action: pan-y`
 * so the browser keeps vertical scrolling while we track horizontal drags).
 * The hook only reports the live drag offset; the resting open/closed
 * transform is driven by CSS via the controlled `revealed` prop.
 */
export function useSwipeReveal({ revealed, onRevealChange }: ISwipeRevealOptions): ISwipeRevealHandle {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)

  const startRef = useRef<{ x: number; y: number } | null>(null)
  const axisRef = useRef<SwipeAxis>('undecided')
  const draggedRef = useRef(false)

  const revealedRef = useRef(revealed)
  revealedRef.current = revealed
  const onRevealChangeRef = useRef(onRevealChange)
  onRevealChangeRef.current = onRevealChange

  useEffect(() => {
    if (!revealed) {
      return
    }
    const closeOnOutside = (event: Event) => {
      const root = rootRef.current
      if (root && event.target instanceof Node && root.contains(event.target)) {
        return
      }
      onRevealChangeRef.current(false)
    }
    document.addEventListener('touchstart', closeOnOutside, { capture: true, passive: true })
    document.addEventListener('mousedown', closeOnOutside, { capture: true })
    return () => {
      document.removeEventListener('touchstart', closeOnOutside, { capture: true })
      document.removeEventListener('mousedown', closeOnOutside, { capture: true })
    }
  }, [revealed])

  const endDrag = () => {
    const wasDragging = axisRef.current === 'x'
    startRef.current = null
    axisRef.current = 'undecided'
    setDragging(false)
    setOffset(0)
    return wasDragging
  }

  const onTouchStart = (event: ReactTouchEvent<HTMLElement>) => {
    const touch = event.touches[0]
    if (!touch) {
      return
    }
    startRef.current = { x: touch.clientX, y: touch.clientY }
    axisRef.current = 'undecided'
    draggedRef.current = false
  }

  const onTouchMove = (event: ReactTouchEvent<HTMLElement>) => {
    const start = startRef.current
    const touch = event.touches[0]
    if (!start || !touch) {
      return
    }
    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y

    if (axisRef.current === 'undecided') {
      if (Math.max(Math.abs(dx), Math.abs(dy)) <= AXIS_SLOP) {
        return
      }
      if (Math.abs(dx) <= Math.abs(dy)) {
        axisRef.current = 'y'
        startRef.current = null
        return
      }
      axisRef.current = 'x'
      draggedRef.current = true
      setDragging(true)
    }

    const base = revealedRef.current ? -SWIPE_ACTION_WIDTH : 0
    const next = clampOffset(base + dx)
    const wasArmed = offsetIsArmed(offset)
    setOffset(next)
    if (!wasArmed && offsetIsArmed(next) && !revealedRef.current && 'vibrate' in navigator) {
      navigator.vibrate(10)
    }
  }

  const onTouchEnd = () => {
    const armed = offsetIsArmed(offset)
    if (endDrag()) {
      onRevealChangeRef.current(armed)
    }
  }

  const onTouchCancel = () => {
    endDrag()
  }

  const consumeDrag = () => {
    const dragged = draggedRef.current
    draggedRef.current = false
    return dragged
  }

  return {
    rootRef,
    offset,
    dragging,
    consumeDrag,
    handlers: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel },
  }
}
